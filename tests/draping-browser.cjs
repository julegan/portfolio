const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');
const origin = 'http://127.0.0.1:4173';

async function audit(page, label) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], label);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' fits viewport');
}

async function facePixels(page) {
  return page.evaluate(() => ['portrait-a', 'portrait-b'].map(id => {
    const ctx = document.getElementById(id).getContext('2d');
    // Central patch is inside the oval, excluding its boundary and crosshair.
    return Array.from(ctx.getImageData(400, 300, 100, 100).data);
  }));
}

async function comparisonChecks(browser, name, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [], unexpected = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', request => {
    if (new URL(request.url()).origin !== origin || request.method() !== 'GET') unexpected.push(request.url());
  });
  try {
    await page.goto(origin + '/projects/color-lab/draping/');
    await page.waitForFunction(() => document.getElementById('source-tag').textContent === 'Illustrated sample');
    await audit(page, name + ' initial ' + width);
    const before = await facePixels(page);
    assert.deepEqual(before[0], before[1], 'Both views use identical portrait pixels');
    await page.locator('#pair-study').selectOption('intensity');
    assert.match(await page.locator('#measured-body').innerText(), /similar lightness/);
    assert.deepEqual((await facePixels(page))[0], before[0], 'Changing drapes does not alter the portrait');
    await page.getByRole('button', { name: 'Prefer B', exact: true }).click();
    assert.match(await page.locator('#preference-status').innerText(), /preferred B/);
    await page.locator('#show-numbers').click();
    assert(await page.locator('#color-measurements').isVisible());
    await page.locator('#save-a').click();
    await page.locator('#save-a').click();
    assert.equal(await page.locator('.palette-chip').count(), 1);
    const paletteDownload = page.waitForEvent('download');
    await page.locator('#download-palette').click();
    const palettePath = await (await paletteDownload).path();
    const exported = JSON.parse(require('node:fs').readFileSync(palettePath, 'utf8'));
    assert.deepEqual(Object.keys(exported).sort(), ['colors', 'format', 'version']);
    assert.equal(exported.colors.length, 1);

    await page.locator('#hex-b').fill('invalid'); await page.locator('#hex-b').press('Tab');
    assert.equal(await page.locator('#hex-b').getAttribute('aria-invalid'), 'true');
    await page.locator('#hex-b').fill('#126c54'); await page.locator('#hex-b').press('Tab');
    assert.equal(await page.locator('#hex-b').inputValue(), '#126C54');
    await page.getByText('Inspect a feature color', { exact: true }).click(); await page.locator('#inspect').click();
    await page.locator('#sample-y').press('ArrowRight');
    assert.match(await page.locator('#feature-comparison').innerText(), /Image sample/);
    await audit(page, name + ' expanded ' + width);

    // A synthetic image exercises decoding and local upload without retaining a
    // person's portrait or requiring a remote test image.
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 800;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#567891'; ctx.fillRect(0, 0, 640, 800);
      ctx.fillStyle = '#B29278'; ctx.fillRect(200, 160, 240, 430);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#photo').setInputFiles({ name: 'synthetic-test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(() => document.getElementById('source-tag').textContent.includes('Your photo'));
    await page.waitForFunction(() => /No single face found|Face framing is active|Automatic framing is unavailable/.test(document.getElementById('tracking-status').textContent), null, { timeout: 60000 });
    const uploaded = await facePixels(page);
    assert.deepEqual(uploaded[0], uploaded[1], 'Uploaded portrait is identical in both views');
    const shotDownload = page.waitForEvent('download'); await page.locator('#download-comparison').click();
    const shot = require('node:fs').readFileSync(await (await shotDownload).path());
    assert.equal(shot.readUInt32BE(16), 1920); assert.equal(shot.readUInt32BE(20), 1320);
    const storage = await page.evaluate(async () => ({ local: { ...localStorage }, session: { ...sessionStorage }, databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).length : null }));
    assert.equal(Object.keys(storage.local).length, 1);
    assert(!JSON.stringify(storage).includes('data:image'));
    assert.deepEqual(storage.session, {});
    if (storage.databases !== null) assert.equal(storage.databases, 0);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#source-tag').innerText(), 'No portrait');
    assert.equal(await page.locator('#download-comparison').isEnabled(), false);
    assert.equal(await page.locator('.palette-chip').count(), 1, 'Clearing portrait preserves colors only');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('source-tag').textContent === 'Illustrated sample');
    assert.equal(await page.locator('.palette-chip').count(), 1);
    assert.equal(await page.locator('#source-tag').innerText(), 'Illustrated sample');
    assert.deepEqual(errors, [], 'No uncaught errors');
    assert.deepEqual(unexpected, [], 'No external requests or image uploads');
    console.log('PASS ' + name + ' draping controls, private uploads, tracking initialization, exact portrait comparison, downloads, persistence, accessibility ' + width);
  } finally { await context.close(); }
}

async function cameraChecks(browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.testCamera = { stops: 0, requests: [] };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async constraints => {
      window.testCamera.requests.push(constraints);
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      function draw() { ctx.fillStyle = '#8A7362'; ctx.fillRect(0, 0, 640, 480); }
      draw(); const timer = setInterval(draw, 60);
      const stream = canvas.captureStream(15);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); window.testCamera.stops++; stop(); };
      }
      return stream;
    } });
  });
  const page = await context.newPage();
  try {
    await page.goto(origin + '/projects/color-lab/draping/');
    await page.locator('#start-camera').click();
    await page.waitForFunction(() => !document.getElementById('freeze').disabled);
    assert.equal(await page.locator('#download-comparison').isEnabled(), false);
    assert.equal(await page.locator('#inspect').isEnabled(), false);
    assert.equal(await page.evaluate(() => testCamera.requests[0].audio), false);
    await page.locator('#freeze').click();
    assert.match(await page.locator('#source-tag').innerText(), /camera off/);
    assert.equal(await page.evaluate(() => testCamera.stops), 1);
    const pixels = await facePixels(page); assert.deepEqual(pixels[0], pixels[1]);
    assert.equal(await page.locator('#download-comparison').isEnabled(), true);
    await page.locator('#start-camera').click();
    await page.waitForFunction(() => !document.getElementById('freeze').disabled);
    await page.locator('#clear').click();
    assert.equal(await page.evaluate(() => testCamera.stops), 2);
    await page.locator('#start-camera').click();
    await page.waitForFunction(() => !document.getElementById('freeze').disabled);
    const other = await context.newPage(); await other.goto('about:blank');
    // Explicitly dispatch lifecycle event so the test doesn't depend on headless
    // tab-visibility behavior. The actual handler also runs on real visibility.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    assert.equal(await page.evaluate(() => testCamera.stops), 3);
    console.log('PASS live camera mirror, freeze, clear and page-leave release all tracks');
  } finally { await context.close(); }
}

async function fallbackChecks(browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  });
  const page = await context.newPage();
  try {
    await page.goto(origin + '/projects/color-lab/draping/');
    await page.locator('#save-a').click();
    assert(await page.locator('#download-palette').isEnabled());
    assert.match(await page.locator('#palette-status').innerText(), /unavailable/);
    await page.locator('#start-camera').click();
    await page.waitForFunction(() => document.getElementById('source-status').textContent.includes('not granted'));
    assert(await page.locator('#start-camera').isEnabled());
    console.log('PASS camera denial and blocked-storage fallbacks');
  } finally { await context.close(); }
}

(async () => {
  for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await type.launch();
    try {
      for (const width of [1440, 390, 320]) await comparisonChecks(browser, name, width);
      await fallbackChecks(browser);
      if (name === 'Chromium') await cameraChecks(browser);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
