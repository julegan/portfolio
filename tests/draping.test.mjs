import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toOKLCH } from '../dist/projects/draping-mirror/color.mjs';
import { PALETTE_KEY, STUDIES, fitColor, compareColors, portraitCrop, landmarkFrame, readPalette } from '../dist/projects/draping-mirror/drapes.mjs';
import worker from '../src/shows-feedback.mjs';
import { isDrapingPath } from '../src/draping-headers.mjs';

test('controlled comparisons separate lightness and chroma after sRGB quantization', () => {
  const depth = compareColors(...STUDIES.depth.colors);
  assert(depth.lightness > 38);
  assert(Math.abs(depth.chroma) < .003);
  const intensity = compareColors(...STUDIES.intensity.colors);
  assert(Math.abs(intensity.lightness) < .5);
  assert(intensity.chroma > .14);
});

test('out-of-gamut requests reduce chroma and report displayed measurements', () => {
  const fitted = fitColor(.6, .3, 180);
  assert.equal(fitted.fitted, true);
  const point = toOKLCH(fitted.hex);
  assert(Math.abs(point.lightness - .6) < .003);
  assert(point.chroma < .3);
  assert(Math.abs(point.hue - 180) < 1);
  assert.equal(fitColor(.5, 0, 30).fitted, false);
});

test('portrait crop stays inside image bounds on all supported orientations', () => {
  for (const [w, h] of [[1600, 900], [900, 1600], [740, 560], [1, 1]]) {
    for (const x of [0, .5, 1]) for (const y of [0, .5, 1]) for (const zoom of [.7, 1, 2.4]) {
      const crop = portraitCrop(w, h, { x, y, zoom });
      assert(crop.x >= 0 && crop.y >= 0);
      assert(crop.width > 0 && crop.height > 0);
      assert(crop.x + crop.width <= w + 1e-8 && crop.y + crop.height <= h + 1e-8);
      assert(Math.abs(crop.width / crop.height - 280 / 370) < 1e-8);
    }
  }
  assert.equal(landmarkFrame([], 640, 480), null);
  assert(landmarkFrame([{ x: .4, y: .2 }, { x: .6, y: .7 }], 640, 480).zoom >= .7);
});

test('palette persistence accepts only validated colors and never image records', () => {
  assert.deepEqual(readPalette('["#fff","#FFFFFF",{"photo":"data:image/jpeg;base64,private"},"invalid","#126c54"]'), ['#FFFFFF', '#126C54']);
  assert.deepEqual(readPalette(null), []);
  assert.throws(() => readPalette('{broken'));
  assert.throws(() => readPalette('{"photo":"private"}'));
});

test('only draping paths receive camera permission; requests cannot upload photos', async () => {
  const calls = [];
  const env = { ASSETS: { fetch: async request => {
    calls.push(request.method);
    return new Response('<html>mirror</html>', { headers: { 'Content-Type': 'text/html', 'Permissions-Policy': 'camera=(), microphone=()' } });
  } } };
  assert(isDrapingPath('/projects/draping-mirror/'));
  assert(isDrapingPath('/projects/draping-mirror'));
  assert(!isDrapingPath('/projects/color-lab/'));
  assert(!isDrapingPath('/projects/color-lab/draping/'));
  assert(!isDrapingPath('/projects/draping-mirror-other/'));
  const response = await worker.fetch(new Request('https://julieowens.me/projects/draping-mirror/'), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Permissions-Policy'), /^camera=\(self\), microphone=\(\)/);
  assert.match(response.headers.get('Content-Security-Policy'), /connect-src 'self'/);
  assert.match(response.headers.get('Content-Security-Policy'), /form-action 'none'/);
  for (const method of ['POST', 'PUT', 'PATCH']) {
    const result = await worker.fetch(new Request('https://julieowens.me/projects/draping-mirror/', { method, body: 'private photo' }), env);
    assert.equal(result.status, 405);
  }
  assert.deepEqual(calls, ['GET']);
  const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(config, /"\/projects\/draping-mirror\/\*"/);
});

test('personal color and digital color selection remain independent projects', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  for (const file of ['index.html', 'mirror.css', 'mirror.mjs', 'drapes.mjs', 'color.mjs']) {
    const source = read('dist/projects/draping-mirror/' + file);
    assert.doesNotMatch(source, /color[- .]?lab|\.\.\/.*(?:\.css|\.mjs)/i, file + ' must not depend on Color Lab');
  }
  assert.doesNotMatch(read('dist/projects/color-lab/index.html'), /draping/i);
  assert.match(read('dist/projects/index.html'), /href="\/projects\/draping-mirror\/"/);
  assert.equal(PALETTE_KEY, 'julieowens.draping-mirror.palette.v1');
});
