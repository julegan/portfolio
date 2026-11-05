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
  const { normalizeHex, sample, sampleRGB, rgbLuminance, toOKLCH, contrast, nearbyShade } = engine;
  assert.equal(normalizeHex('f0c'), '#FF00CC');
  assert.equal(normalizeHex('#ffff0000'), null);
  assert.equal(contrast('#000000', '#FFFFFF'), 21);
  assert(contrast('#777777', '#FFFFFF') < 4.5);
  assert(contrast('#767676', '#FFFFFF') > 4.5);
  assert(Math.abs(contrast('#FF0000', '#FFFFFF') - 3.9984767707539985) < 1e-8);
  for (const color of ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#17161A', '#DE85F2']) {
    const point = toOKLCH(color);
    assert.equal(sample(point.lightness, point.chroma, point.hue), color);
    assert.deepEqual(sampleRGB(point.lightness, point.chroma, point.hue), color.slice(1).match(/../g).map(pair => parseInt(pair, 16)));
  }
  assert.equal(rgbLuminance([255, 0, 0]), 0.2126);
  assert.equal(rgbLuminance([0, 255, 0]), 0.7152);
  assert.equal(rgbLuminance([0, 0, 255]), 0.0722);
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

async function assertMapResolution(page, id = 'field') {
  await page.waitForFunction(id => {
    const field = document.getElementById(id);
    const bounds = field.getBoundingClientRect();
    return field.width === Math.round(bounds.width * devicePixelRatio) &&
      field.height === Math.round(bounds.height * devicePixelRatio);
  }, id);
}

async function mapRenderingChecks(browser, name, deviceScaleFactor) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor });
  const page = await context.newPage();
  const { sample, toOKLCH, contrast } = await import('../dist/projects/color-lab/engine.mjs');
  try {
    await page.goto(origin + '/projects/color-lab/');
    await assertMapResolution(page);
    const pixels = await page.locator('#field').evaluate(field => ({
      width: field.width,
      height: field.height,
      rows: [0.1, 0.35, 0.6, 0.85].map(fraction => {
        const y = Math.floor(fraction * (field.height - 1));
        return { y, data: Array.from(field.getContext('2d').getImageData(0, y, field.width, 1).data) };
      })
    }));
    let allowed = 0;
    let belowTarget = 0;
    let outsideGamut = 0;
    for (const row of pixels.rows) {
      for (let x = 0; x < pixels.width; x++) {
        const hex = sample(1 - row.y / (pixels.height - 1), x / (pixels.width - 1) * 0.4, toOKLCH('#DE85F2').hue);
        const actual = row.data.slice(x * 4, x * 4 + 3);
        if (!hex) {
          outsideGamut++;
          assert([[114, 108, 121], [34, 33, 39]].some(color => color.every((channel, index) => channel === actual[index])));
        } else if (contrast(hex, '#17161A') < 4.5) {
          belowTarget++;
          assert([[81, 76, 88], [40, 38, 46]].some(color => color.every((channel, index) => channel === actual[index])));
        } else {
          allowed++;
          const expected = hex.slice(1).match(/../g).map(pair => parseInt(pair, 16));
          assert.deepEqual(actual, expected, 'Visible color pixels match the picker, including pixels beside each boundary');
        }
      }
    }
    assert(allowed && belowTarget && outsideGamut, 'The checks cross both map boundaries');
    await page.setViewportSize({ width: 640, height: 900 });
    await assertMapResolution(page);
    await page.locator('#show-space').click();
    await assertMapResolution(page, 'space');
    console.log('PASS Color Lab native map resolution, exact boundary pixels and resizing ' + name + ' density ' + deviceScaleFactor);
  } finally {
    await context.close();
  }
}

async function explorerGeometryChecks() {
  const { colorPoint, colorSamples, projector } = await import('../dist/projects/color-lab/explorer.mjs');
  const { toOKLCH, contrast } = await import('../dist/projects/color-lab/engine.mjs');
  const colors = colorSamples();
  assert(colors.length > 5000, 'Volume samples cover the sRGB gamut');
  assert.equal(new Set(colors.map(color => color.hex)).size, colors.length, 'Samples are unique hex colors');
  assert(Math.abs(colorPoint('#000000')[1] + 1) < 1e-6);
  assert(Math.abs(colorPoint('#FFFFFF')[1] - 1) < 1e-6);
  for (const color of colors) {
    const oklch = toOKLCH(color.hex);
    assert(Math.abs(Math.hypot(color.point[0], color.point[2]) - 2 * oklch.chroma) < 1e-8);
    assert(Math.abs(color.point[1] - 2 * (oklch.lightness - 0.5)) < 1e-8);
  }
  assert.equal(colors.filter(color => contrast(color.hex, '#777777') >= 7).length, 0);
  const project = projector({ rotation: 0, tilt: 0, zoom: 1 }, 600, 600);
  assert.equal(project([0, 0, 0]).x, 300);
  assert.equal(project([0, 0, 0]).y, 300);
  assert(project([1, 0, 0]).x > 300);
  assert(project([0, 1, 0]).y < 300);
  console.log('PASS 3D explorer color coordinates, unique gamut samples and projection');
}

async function explorerChecks(page, name, viewport) {
  const { colorSamples, projector } = await import('../dist/projects/color-lab/explorer.mjs');
  const { contrast, toOKLCH } = await import('../dist/projects/color-lab/engine.mjs');
  await applyHex(page, '#reference-hex', '#DE85F2');
  const initialColor = await page.locator('#foreground').innerText();
  await page.locator('#show-space').click();
  assert.equal(await page.locator('#show-space').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#map-view').isVisible(), false);
  await assertMapResolution(page, 'space');
  assert.equal(await page.locator('#foreground').innerText(), initialColor, 'Switching views preserves the selected color');
  const volumeStatus = await page.locator('#space-status').innerText();
  assert.match(volumeStatus, /sampled colors meet the target/);
  await page.getByText('Camera controls', { exact: true }).click();
  await page.locator('#rotation').press('ArrowRight');
  assert.equal(await page.locator('#rotation').inputValue(), '-79');
  assert.equal(await page.locator('#foreground').innerText(), initialColor, 'Camera controls preserve color selection');

  await page.locator('#space').scrollIntoViewIfNeeded();
  let box = await page.locator('#space').boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await page.locator('#rotation').inputValue(), '-79', 'Dragging rotates the model');
  assert.equal(await page.locator('#foreground').innerText(), initialColor, 'Dragging never picks a sample');
  if (name === 'Chromium' && viewport.width < 760) {
    const session = await page.context().newCDPSession(page);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: centerX - 30, y: centerY, id: 1 }, { x: centerX + 30, y: centerY, id: 2 }]
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: centerX - 45, y: centerY, id: 1 }, { x: centerX + 45, y: centerY, id: 2 }]
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    assert(Number(await page.locator('#zoom').inputValue()) > 100, 'A two-finger pinch zooms the model');
    assert.equal(await page.locator('#foreground').innerText(), initialColor, 'Ending a pinch never selects a color');
  }
  await page.locator('#reset-camera').click();
  assert.equal(await page.locator('#rotation').inputValue(), '-80');
  assert.equal(await page.locator('#tilt').inputValue(), '20');
  await page.locator('#isolate-slice').check();
  assert.notEqual(await page.locator('#space-status').innerText(), volumeStatus, 'Isolating the hue changes the sample set');
  await page.locator('#show-excluded').uncheck();
  await page.locator('#face-slice').click();
  assert.equal(await page.locator('#tilt').inputValue(), '0');
  await audit(page, name + ' 3D explorer and expanded camera controls ' + viewport.width);

  await page.locator('#space').scrollIntoViewIfNeeded();
  box = await page.locator('#space').boundingBox();
  const hue = toOKLCH(initialColor).hue;
  const candidate = colorSamples(hue).find(color => {
    const position = toOKLCH(color.hex);
    return color.hex !== initialColor && contrast(color.hex, '#17161A') >= 4.5 &&
      position.chroma > 0.08 && position.lightness > 0.65 && position.lightness < 0.85;
  });
  assert(candidate, 'A distinct selectable sample exists in the current hue slice');
  const project = projector({ rotation: hue * Math.PI / 180, tilt: 0, zoom: 1 }, box.width, box.height);
  const point = project(candidate.point);
  if (viewport.width < 760) await page.touchscreen.tap(box.x + point.x, box.y + point.y);
  else await page.locator('#space').click({ position: { x: point.x, y: point.y } });
  const picked = await page.locator('#foreground').innerText();
  assert.notEqual(picked, initialColor, 'Tapping or clicking a visible 3D sample selects a color');
  assert(contrast(picked, '#17161A') >= 4.5);
  assert.equal(await page.locator('#reference-hex').inputValue(), '#DE85F2', '3D selection preserves the starting color');
  assert.match(await page.locator('#selected-values').innerText(), new RegExp(picked));
  await page.locator('#save-pair').click();
  assert(await page.getByRole('button', { name: 'Load pair ' + picked + ' on #17161A', exact: true }).isVisible());
  await page.locator('#show-map').click();
  await assertMapResolution(page);
  assert.equal(await page.locator('#foreground').innerText(), picked);
  await page.locator('#show-space').click();
  await assertMapResolution(page, 'space');
  assert.equal(await page.locator('#foreground').innerText(), picked);

  await applyHex(page, '#hex', '#777777');
  await page.locator('#target').selectOption('aaa-normal');
  assert.match(await page.locator('#space-status').innerText(), /^0 of /);
  assert.equal(await page.locator('#foreground').innerText(), picked, 'An impossible contrast target preserves the current choice');
  await audit(page, name + ' 3D empty eligible set ' + viewport.width);
  console.log('PASS 3D explorer selection, rotation, touch/keyboard controls, view sync and saving ' + name + ' ' + viewport.width);
}

async function browserChecks(browser, name, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 760 });
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
    await page.getByRole('button', { name: 'Load pair ' + candidate + ' on #FFFFFF', exact: true }).click();
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
    await explorerChecks(page, name, viewport);
    const overflow = await page.evaluate(() => ({
      fits: document.documentElement.scrollWidth <= innerWidth + 1,
      outside: Array.from(document.querySelectorAll('main *')).filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.right > innerWidth + 1;
      }).map(element => element.id || element.className || element.tagName).slice(0, 12)
    }));
    assert(overflow.fits, 'Fits viewport ' + viewport.width + ', outside elements ' + overflow.outside.join(', '));
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
  await explorerGeometryChecks();
  for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await type.launch();
    try {
      for (const density of [1, 2, 3]) await mapRenderingChecks(browser, name, density);
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
