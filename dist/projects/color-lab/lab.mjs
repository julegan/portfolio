import { normalizeHex, toOKLCH, sample, contrast, nearbyShade } from './engine.mjs';

const byId = id => document.getElementById(id);
const targets = {
  'aa-normal': 4.5,
  'aa-large': 3,
  'aaa-normal': 7,
  'aaa-large': 4.5
};
const fonts = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, monospace'
};
const savedPrefix = 'julieowens.color-lab.pair.v1.';
const field = byId('field');
const context = field.getContext('2d');
let background = '#17161A';
let reference = '#DE85F2';
let selected = reference;
let position = toOKLCH(selected);
let hue = position.hue;
let suggestion = null;
let drawRequested = false;
let bodySize = 16;

function ratioText(value) {
  // Keep the displayed figure below the exact value at a threshold boundary.
  return (Math.floor(value * 100) / 100).toFixed(2) + ':1';
}

function syncCoordinates() {
  for (const [name, value] of [
    ['hue', hue.toFixed(1)],
    ['lightness', position.lightness.toFixed(3)],
    ['chroma', position.chroma.toFixed(3)]
  ]) {
    byId(name).value = value;
    byId(name + '-number').value = value;
  }
  byId('marker').style.left = position.chroma / 0.4 * 100 + '%';
  byId('marker').style.top = (1 - position.lightness) * 100 + '%';
}

function drawMap() {
  drawRequested = false;
  const { width, height } = field;
  const pixels = context.createImageData(width, height);
  const target = targets[byId('target').value];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hex = sample(1 - y / (height - 1), x / (width - 1) * 0.4, hue);
      let rgb;
      if (!hex) {
        const dot = x % 4 === 0 && y % 4 === 0;
        rgb = dot ? [114, 108, 121] : [34, 33, 39];
      } else if (contrast(hex, background) < target) {
        const stripe = (x + y) % 7 < 2;
        rgb = stripe ? [81, 76, 88] : [40, 38, 46];
      } else {
        rgb = hex.slice(1).match(/../g).map(pair => parseInt(pair, 16));
      }
      const offset = (y * width + x) * 4;
      pixels.data.set([...rgb, 255], offset);
    }
  }
  context.putImageData(pixels, 0, 0);
}

function requestMap() {
  if (drawRequested) return;
  drawRequested = true;
  requestAnimationFrame(drawMap);
}

function sampleTargets(size, weight) {
  const large = size >= 24 || (size >= 56 / 3 && weight >= 700);
  return { aa: large ? 3 : 4.5, aaa: large ? 4.5 : 7 };
}

function sampleCheck(label, size, weight, measured) {
  const required = sampleTargets(size, weight);
  return label + ' ' + size + ' px · AA ' + (measured >= required.aa ? 'pass' : 'below target') +
    ' · AAA ' + (measured >= required.aaa ? 'pass' : 'below target');
}

function updateSamples() {
  const size = bodySize;
  const weight = Number(byId('text-weight').value);
  const headingSize = Math.max(24, size * 1.5);
  const labelSize = Math.max(12, size - 2);
  for (const [name, color] of [['original', reference], ['selected', selected]]) {
    const specimen = byId(name + '-specimen');
    specimen.style.color = color;
    specimen.style.backgroundColor = background;
    specimen.style.fontFamily = fonts[byId('font-family').value];
    specimen.style.setProperty('--body-size', size + 'px');
    specimen.style.setProperty('--heading-size', headingSize + 'px');
    specimen.style.setProperty('--label-size', labelSize + 'px');
    specimen.style.setProperty('--text-weight', weight);
    specimen.style.setProperty('--line-height', byId('line-height').value);
    specimen.querySelector('.sample-body').textContent = byId('sample-text').value;
    const measured = contrast(color, background);
    byId(name + '-values').textContent = color + ' · ' + ratioText(measured);
    byId(name + '-checks').textContent = [
      sampleCheck('Body', size, weight, measured),
      sampleCheck('Heading', headingSize, 700, measured),
      sampleCheck('Label', labelSize, weight, measured)
    ].join('\n');
  }
  const measured = contrast(selected, background);
  const required = sampleTargets(size, weight);
  let feedback = 'The body sample meets the AAA text contrast target at this size and weight. Check how comfortably you can read several lines.';
  if (measured < required.aa) {
    feedback = 'The body sample falls below the AA text contrast target at this size and weight. Try more contrast, a larger size or a bold weight.';
  } else if (measured < required.aaa) {
    feedback = 'The body sample meets AA. The AAA text contrast target provides more contrast headroom for this size and weight.';
  }
  if (weight === 300) feedback += ' Light strokes can render faintly. Compare with Regular or Bold.';
  byId('reading-feedback').textContent = feedback;
}

function updateSelection() {
  const measured = contrast(selected, background);
  const target = targets[byId('target').value];
  byId('foreground').textContent = selected;
  byId('ratio').textContent = ratioText(measured);
  byId('selection-status').textContent = measured >= target ? 'Meets your selected contrast target.' : 'Below your selected contrast target.';
  const difference = Math.abs(measured - target);
  const margin = difference < 0.01 ? 'Less than 0.01' : (Math.floor(difference * 100) / 100).toFixed(2);
  byId('margin').textContent = margin + (measured >= target ? ' above ' : ' below ') + 'your ' + target + ':1 target.';
  syncCoordinates();
  updateSamples();
}

function updateSuggestion() {
  const target = targets[byId('target').value];
  suggestion = nearbyShade(reference, background, target);
  const button = byId('apply-suggestion');
  button.hidden = !suggestion || suggestion === reference;
  if (!suggestion) {
    byId('suggestion-description').textContent = 'This background has no text color that meets this target. Try a lighter or darker background, or change the target.';
    return;
  }
  if (suggestion === reference) {
    byId('suggestion-description').textContent = 'Your starting color already meets this contrast target. Explore variations in the map.';
    return;
  }
  const originalPosition = toOKLCH(reference);
  const proposed = toOKLCH(suggestion);
  const lightnessChange = proposed.lightness - originalPosition.lightness;
  const chromaChange = proposed.chroma - originalPosition.chroma;
  const lightnessWords = lightnessChange >= 0 ? 'lightness increases' : 'lightness decreases';
  const chromaWords = chromaChange >= 0 ? 'chroma increases' : 'chroma decreases';
  byId('suggestion-description').textContent = suggestion + ' meets the target at ' +
    ratioText(contrast(suggestion, background)) + '. At the starting hue, ' +
    lightnessWords + ' by ' + Math.abs(lightnessChange).toFixed(3) + ' and ' +
    chromaWords + ' by ' + Math.abs(chromaChange).toFixed(3) + '.';
}

function updateContext() {
  byId('map-message').textContent = '';
  requestMap();
  updateSuggestion();
  updateSelection();
}

function useColor(color) {
  selected = color;
  position = toOKLCH(color);
  hue = position.hue;
  byId('map-message').textContent = '';
  requestMap();
  updateSelection();
}

function choosePosition(lightness, chroma, requireTarget = false) {
  const color = sample(lightness, chroma, hue);
  if (!color) {
    byId('map-message').textContent = 'That position is outside sRGB. Try reducing chroma.';
    syncCoordinates();
    return;
  }
  if (requireTarget && contrast(color, background) < targets[byId('target').value]) {
    byId('map-message').textContent = 'That position is below the contrast target. Choose a colored area.';
    return;
  }
  selected = color;
  position = { lightness, chroma, hue };
  byId('map-message').textContent = '';
  updateSelection();
}

function changeHue(value) {
  hue = value % 360;
  let chroma = position.chroma;
  if (!sample(position.lightness, chroma, hue)) {
    let lower = 0;
    let upper = chroma;
    for (let i = 0; i < 16; i++) {
      const middle = (lower + upper) / 2;
      if (sample(position.lightness, middle, hue)) lower = middle;
      else upper = middle;
    }
    chroma = lower;
  }
  const reduction = position.chroma - chroma;
  choosePosition(position.lightness, chroma);
  if (reduction > 0.001) byId('map-message').textContent = 'Chroma reduced by ' + reduction.toFixed(3) + ' to keep this hue within sRGB.';
  requestMap();
}

function bindHex(colorId, textId, errorId, apply) {
  const color = byId(colorId);
  const text = byId(textId);
  color.addEventListener('input', () => {
    text.value = color.value.toUpperCase();
    text.removeAttribute('aria-invalid');
    byId(errorId).textContent = '';
    apply(text.value);
  });
  function applyText() {
    const normalized = normalizeHex(text.value);
    if (!normalized) {
      text.setAttribute('aria-invalid', 'true');
      byId(errorId).textContent = 'Enter 3 or 6 hex digits to apply a color.';
      return;
    }
    color.value = normalized;
    color.dispatchEvent(new Event('input'));
  }
  text.addEventListener('change', applyText);
  text.addEventListener('input', () => {
    if (/^#?[0-9a-f]{6}$/i.test(text.value.trim())) applyText();
  });
  text.addEventListener('keydown', event => {
    if (event.key === 'Enter') applyText();
  });
}

bindHex('bg', 'hex', 'background-error', color => {
  background = color;
  updateContext();
});
bindHex('reference', 'reference-hex', 'reference-error', color => {
  reference = color;
  useColor(color);
  updateSuggestion();
});
byId('target').addEventListener('change', updateContext);
byId('apply-suggestion').addEventListener('click', () => {
  if (suggestion) useColor(suggestion);
});
byId('restore-reference').addEventListener('click', () => useColor(reference));
byId('aim-higher').addEventListener('click', () => {
  byId('target').value = 'aaa-normal';
  updateContext();
});

for (const name of ['hue', 'lightness', 'chroma']) {
  for (const suffix of ['', '-number']) {
    const input = byId(name + suffix);
    input.addEventListener(suffix ? 'change' : 'input', () => {
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      const value = input.valueAsNumber;
      if (!Number.isFinite(value)) return;
      if (name === 'hue') changeHue(value);
      else if (name === 'lightness') choosePosition(value, position.chroma);
      else choosePosition(position.lightness, value);
    });
  }
}

function chooseFromPointer(event) {
  const rect = field.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  choosePosition(1 - y, x * 0.4, true);
}
field.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  field.setPointerCapture(event.pointerId);
  chooseFromPointer(event);
});
field.addEventListener('pointermove', event => {
  if (field.hasPointerCapture(event.pointerId)) chooseFromPointer(event);
});
field.addEventListener('pointerup', event => {
  if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
});

byId('text-size').addEventListener('change', () => {
  const input = byId('text-size');
  if (!input.checkValidity() || !Number.isFinite(input.valueAsNumber)) {
    input.reportValidity();
    return;
  }
  bodySize = input.valueAsNumber;
  updateSamples();
});
for (const name of ['text-weight', 'font-family', 'line-height']) {
  byId(name).addEventListener('change', updateSamples);
}
byId('sample-text').addEventListener('input', updateSamples);

function readSaved() {
  const pairs = [];
  try {
    let unreadable = false;
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(savedPrefix)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(storageKey));
        const foreground = normalizeHex(value.foreground);
        const savedBackground = normalizeHex(value.background);
        if (value.version !== 1 || !foreground || !savedBackground || !Object.hasOwn(targets, value.target)) throw new Error('Invalid saved pair');
        pairs.push({ storageKey, foreground, background: savedBackground, target: value.target });
      } catch {
        unreadable = true;
      }
    }
    byId('storage-status').textContent = unreadable ? 'A saved pair could not be read. Other saved pairs are available.' : '';
    return pairs;
  } catch {
    byId('storage-status').textContent = 'Saving in this browser is unavailable. Copy the CSS to keep a pair.';
    return null;
  }
}

function renderSaved() {
  const pairs = readSaved();
  byId('save-pair').disabled = pairs === null;
  const container = byId('saved-pairs');
  container.replaceChildren();
  if (!pairs?.length) {
    if (pairs) byId('storage-status').textContent ||= 'Save a pair to compare it here.';
    return;
  }
  for (const pair of pairs) {
    const card = document.createElement('div');
    card.className = 'saved-card';
    const preview = document.createElement('div');
    preview.className = 'saved-sample';
    preview.setAttribute('data-contrast-specimen', '');
    preview.style.color = pair.foreground;
    preview.style.backgroundColor = pair.background;
    preview.textContent = 'Color in context';
    const measured = contrast(pair.foreground, pair.background);
    const description = document.createElement('p');
    description.textContent = pair.foreground + ' on ' + pair.background + ' · ' + ratioText(measured) +
      ' · ' + (measured >= targets[pair.target] ? 'meets' : 'below') + ' saved ' + targets[pair.target] + ':1 target';
    const actions = document.createElement('div');
    actions.className = 'actions';
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = 'Load pair';
    load.setAttribute('aria-label', 'Load pair ' + pair.foreground + ' on ' + pair.background);
    load.addEventListener('click', () => {
      background = pair.background;
      reference = pair.foreground;
      byId('bg').value = background;
      byId('hex').value = background;
      byId('reference').value = reference;
      byId('reference-hex').value = reference;
      for (const [input, error] of [['hex', 'background-error'], ['reference-hex', 'reference-error']]) {
        byId(input).removeAttribute('aria-invalid');
        byId(error).textContent = '';
      }
      byId('target').value = pair.target;
      useColor(reference);
      updateSuggestion();
      byId('action-status').textContent = 'Loaded ' + pair.foreground + ' on ' + pair.background + '.';
    });
    const remove = document.createElement('button');
    remove.className = 'quiet';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + pair.foreground + ' on ' + pair.background);
    remove.addEventListener('click', () => {
      try {
        localStorage.removeItem(pair.storageKey);
        renderSaved();
        byId('action-status').textContent = 'Removed saved pair.';
        (container.querySelector('button') || byId('save-pair')).focus();
      } catch {
        byId('action-status').textContent = 'The browser could not remove this pair.';
      }
    });
    actions.append(load, remove);
    card.append(preview, description, actions);
    container.append(card);
  }
}

byId('save-pair').addEventListener('click', () => {
  const target = byId('target').value;
  const storageKey = savedPrefix + selected.slice(1) + '.' + background.slice(1) + '.' + target;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, foreground: selected, background, target }));
    renderSaved();
    byId('action-status').textContent = 'Saved ' + selected + ' on ' + background + ' in this browser.';
  } catch {
    byId('action-status').textContent = 'The browser could not save this pair. Copy the CSS to keep it.';
  }
});
window.addEventListener('storage', event => {
  if (event.key === null || event.key.startsWith(savedPrefix)) renderSaved();
});

byId('copy-pair').addEventListener('click', async () => {
  const css = 'color: ' + selected + ';\nbackground-color: ' + background + ';';
  try {
    await navigator.clipboard.writeText(css);
    byId('copy-fallback').hidden = true;
    byId('copy-fallback-label').hidden = true;
    byId('action-status').textContent = 'Copied the selected color pair as CSS.';
  } catch {
    const fallback = byId('copy-fallback');
    fallback.value = css;
    fallback.hidden = false;
    byId('copy-fallback-label').hidden = false;
    fallback.focus();
    fallback.select();
    byId('action-status').textContent = 'Select and copy the CSS below to keep this pair.';
  }
});

const spectrum = [];
for (let degree = 0; degree <= 360; degree += 15) {
  let chroma = 0.15;
  while (!sample(0.7, chroma, degree)) chroma -= 0.005;
  spectrum.push(sample(0.7, chroma, degree) + ' ' + degree / 3.6 + '%');
}
byId('hue').style.setProperty('--hue-track', 'linear-gradient(to right, ' + spectrum.join(', ') + ')');
updateContext();
renderSaved();
