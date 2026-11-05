'use strict';
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');
const origin = 'http://127.0.0.1:4173';
const savedPrefix = 'julieowens.color-lab.pair.v1.';

async function audit(page, label) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    // These regions deliberately demonstrate the user's potentially failing
    // colors. Their explanatory labels and every control remain in the audit.
    const result = await window.axe.run({
      exclude: [['[data-contrast-specimen]']]
    }, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
    });
    return result.violations.map(item => ({
      id: item.id,
      help: item.help,
      nodes: item.nodes.map(node => node.target)
    }));
  });
  assert.deepEqual(violations, [], label);
}

async function applyHex(page, id, value) {
  await page.locator(id).fill(value);
  await page.locator(id).press('Tab');
}

async function engineChecks() {
  const engine = await import('../dist/projects/color-lab/engine.mjs');
  const { normalizeHex, sample, toOKLCH, contrast, nearbyShade } = engine;
  assert.equal(normalizeHex('f0c'), '#FF00CC');
  assert.equal(normalizeHex('#ffff0000'), null);
  assert.equal(contrast('#000000', '#FFFFFF'), 21);
  assert(contrast('#777777', '#FFFFFF') < 4.5);
  assert(contrast('#767676', '#FFFFFF') > 4.5);
  assert(Math.abs(contrast('#FF0000', '#FFFFFF') - 3.9984767707539985) < 1e-8);
  for (const color of ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#17161A', '#DE85F2']) {
    const point = toOKLCH(color);
    assert.equal(sample(point.lightness, point.chroma, point.hue), color);
  }
  assert.equal(sample(0.5, 0.4, 100), null);
  assert.equal(nearbyShade('#777777', '#777777', 7), null);
  assert.equal(nearbyShade('#FFFFFF', '#000000', 7), '#FFFFFF');
  const gray = nearbyShade('#777777', '#FFFFFF', 4.5);
  assert(/^#([0-9A-F]{2})\1\1$/.test(gray), 'A neutral starting color stays neutral');
  const fitted = nearbyShade('#DE85F2', '#FFFFFF', 7);
  assert(contrast(fitted, '#FFFFFF') >= 7, 'A suggestion passes after hex quantization');
  assert(Math.abs(toOKLCH(fitted).hue - toOKLCH('#DE85F2').hue) < 1, 'Chromatic suggestion keeps the starting hue');
  console.log('PASS Color Lab conversion, exact thresholds and hue-preserving suggestions');
}

async function browserChecks(browser, name, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    // Exercise the usable fallback on browsers that refuse clipboard access.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('Clipboard unavailable')) }
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await page.goto(origin + '/projects/color-lab/');
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('main h1').innerText(), 'Color Lab');
    const icon = await page.request.get(new URL(await page.locator('link[rel=icon]').getAttribute('href'), page.url()).href);
    assert(icon.ok() && (await icon.text()).includes('<svg'), 'Favicon loads on the actual project route');
    await audit(page, name + ' initial ' + viewport.width);

    await applyHex(page, '#reference-hex', '#808080');
    await applyHex(page, '#hex', '#fff');
    await page.locator('#target').selectOption('aa-large');
    assert.equal(await page.locator('#foreground').innerText(), '#808080', 'Changing context keeps the selected color');
    assert.match(await page.locator('#selection-status').innerText(), /Meets/);
    assert.match(await page.locator('#selected-checks').innerText(), /Body 16 px · AA below target/);
    assert.match(await page.locator('#selected-checks').innerText(), /Heading 24 px · AA pass/);

    await page.getByText('Adjust the reading samples', { exact: true }).click();
    await page.locator('#text-weight').selectOption('700');
    await page.locator('#text-size').fill('18');
    await page.locator('#text-size').press('Tab');
    assert.match(await page.locator('#selected-checks').innerText(), /Body 18 px · AA below target/);
    await page.locator('#text-size').fill('19');
    await page.locator('#text-size').press('Tab');
    assert.match(await page.locator('#selected-checks').innerText(), /Body 19 px · AA pass/);
    await page.locator('#text-weight').selectOption('300');
    assert.match(await page.locator('#reading-feedback').innerText(), /Light strokes/);
    await page.locator('#font-family').selectOption('serif');
    await page.locator('#line-height').selectOption('2');
    await page.locator('#sample-text').fill('Compare letters, numbers and several lines of your own text.');
    assert.match(await page.locator('#selected-specimen .sample-body').innerText(), /Compare letters/);
    await audit(page, name + ' reading controls and failing sample ' + viewport.width);

    await page.getByRole('button', { name: 'Aim for AAA regular text', exact: true }).click();
    assert.equal(await page.locator('#foreground').innerText(), '#808080');
    await page.locator('#apply-suggestion').click();
    const candidate = await page.locator('#foreground').innerText();
    assert.notEqual(candidate, '#808080');
    assert.equal(await page.locator('#reference-hex').inputValue(), '#808080');
    assert.match(await page.locator('#selection-status').innerText(), /Meets/);

    await page.locator('#save-pair').click();
    await page.locator('#save-pair').click();
    assert.equal(await page.locator('.saved-card').count(), 1, 'Saving the same pair is idempotent');
    await applyHex(page, '#hex', '#17161A');
    await applyHex(page, '#reference-hex', '#DE85F2');
    await page.locator('#target').selectOption('aa-normal');
    await page.locator('#save-pair').click();
    assert.equal(await page.locator('.saved-card').count(), 2);
    await page.reload();
    assert.equal(await page.locator('.saved-card').count(), 2, 'Saved pairs survive a reload');
    await page.getByRole('button', { name: 'Load ' + candidate + ' on #FFFFFF', exact: true }).click();
    assert.equal(await page.locator('#hex').inputValue(), '#FFFFFF');
    assert.equal(await page.locator('#foreground').innerText(), candidate);
    assert.equal(await page.locator('#target').inputValue(), 'aaa-normal');

    await page.locator('#copy-pair').click();
    assert.equal(await page.locator('#copy-fallback').isVisible(), true);
    assert.equal(await page.locator('#copy-fallback').inputValue(), 'color: ' + candidate + ';\nbackground-color: #FFFFFF;');
    await page.getByRole('button', { name: 'Remove ' + candidate + ' on #FFFFFF', exact: true }).click();
    assert.equal(await page.locator('.saved-card').count(), 1);

    await applyHex(page, '#hex', '#777777');
    await page.locator('#target').selectOption('aaa-normal');
    assert.equal(await page.locator('#apply-suggestion').isVisible(), false);
    assert.match(await page.locator('#suggestion-description').innerText(), /no text color/);

    await applyHex(page, '#hex', 'invalid');
    assert.equal(await page.locator('#hex').getAttribute('aria-invalid'), 'true');
    assert.match(await page.locator('#background-error').innerText(), /Enter 3 or 6/);
    await applyHex(page, '#hex', '#17161A');
    assert.equal(await page.locator('#hex').getAttribute('aria-invalid'), null);
    await applyHex(page, '#reference-hex', '#DE85F2');
    await page.locator('#target').selectOption('aa-normal');
    const hueBefore = Number(await page.locator('#hue-number').inputValue());
    await page.locator('#hue').focus();
    await page.locator('#hue').press('ArrowRight');
    assert(Number(await page.locator('#hue-number').inputValue()) > hueBefore, 'Keyboard explores the same color coordinates');
    await page.locator('#chroma-number').fill('0.01');
    await page.locator('#chroma-number').press('Tab');
    await page.locator('#lightness-number').fill('0.8');
    await page.locator('#lightness-number').press('Tab');
    assert.match(await page.locator('#selection-status').innerText(), /Meets/);

    await page.getByText('About the contrast feedback', { exact: true }).click();
    await audit(page, name + ' saved pairs, methods and copy fallback ' + viewport.width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Fits viewport ' + viewport.width);
    assert.deepEqual(errors, [], 'No uncaught page errors');
    console.log('PASS Color Lab reading, preservation, fitting, keyboard, saves and accessibility ' + name + ' ' + viewport.width);
  } finally {
    await context.close();
  }
}

async function storageChecks(browser) {
  const context = await browser.newContext();
  await context.addInitScript(prefix => {
    localStorage.setItem(prefix + 'broken', '{broken JSON');
  }, savedPrefix);
  const page = await context.newPage();
  await page.goto(origin + '/projects/color-lab/');
  assert.match(await page.locator('#storage-status').innerText(), /could not be read/);
  assert.equal(await page.locator('#save-pair').isEnabled(), true);
  await page.locator('#save-pair').click();
  assert.equal(await page.locator('.saved-card').count(), 1);
  const second = await context.newPage();
  await second.goto(origin + '/projects/color-lab/');
  await applyHex(second, '#reference-hex', '#FFFFFF');
  await second.locator('#save-pair').click();
  await page.locator('.saved-card').nth(1).waitFor();
  assert.equal(await page.locator('.saved-card').count(), 2, 'Other tabs receive saved pairs');
  await context.close();

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  const blocked = await blockedContext.newPage();
  await blocked.goto(origin + '/projects/color-lab/');
  assert.equal(await blocked.locator('#save-pair').isDisabled(), true);
  assert.equal(await blocked.locator('#copy-pair').isEnabled(), true);
  assert.match(await blocked.locator('#storage-status').innerText(), /unavailable/);
  await blockedContext.close();
  console.log('PASS Color Lab corrupt storage, cross-tab saves and blocked storage');
}

async function main() {
  await engineChecks();
  for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await type.launch();
    try {
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 780 }]) {
        await browserChecks(browser, name, viewport);
      }
      await storageChecks(browser);
    } finally {
      await browser.close();
    }
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
