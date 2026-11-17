import { SAMPLE_LABELS } from './study.mjs';

const clamp = value => Math.max(0, Math.min(1, value));
const linear = channel => {
  const srgb = channel / 255;
  return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
};

// W3C's sRGB relative luminance. Average in linear light and ignore blank
// or transparent pixels; the comparison surround is drawn on another canvas.
export function meanLightness(pixels) {
  let sum = 0, weight = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    if (!alpha) continue;
    sum += alpha * (.2126 * linear(pixels[i]) + .7152 * linear(pixels[i + 1]) + .0722 * linear(pixels[i + 2]));
    weight += alpha;
  }
  return weight ? 100 * sum / weight : null;
}
export const tonalSpan = values => Math.max(...values) - Math.min(...values);
const initialPoints = [
  { x: .36, y: .55 }, { x: .47, y: .28 }, { x: .60, y: .47 }
];
const examples = {
  light: { a: '#8A8A8A', b: '#B1B1B1', text: 'Light · a small jump between tones' },
  medium: { a: '#606060', b: '#C5C5C5', text: 'Medium · a clearly visible step between tones' },
  high: { a: '#2B2B2B', b: '#E2E2E2', text: 'High · a wide separation between dark and light' }
};

export function createContrast(root, capture, keep) {
  const find = selector => root.querySelector(selector);
  const canvas = find('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const surface = find('.tone-surface'), entries = [...root.querySelectorAll('[data-tone-slot]')];
  const markers = [...root.querySelectorAll('.tone-marker')], status = find('#tone-status');
  const keepButton = find('#keep-reading');
  let points, values, slot;
  function render() {
    markers.forEach((marker, index) => {
      marker.style.left = points[index].x * 100 + '%';
      marker.style.top = points[index].y * 100 + '%';
      marker.dataset.active = String(index === slot);
    });
    entries.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === slot));
      button.querySelector('small').textContent = values[index] === null ? 'Awaiting sample' : values[index].toFixed(1) + '% luminance';
    });
    keepButton.disabled = values.includes(null);
    find('#tone-spread').textContent = keepButton.disabled ? 'Sample all three areas to see the tonal span.' :
      'Tonal span · ' + tonalSpan(values).toFixed(1) + ' percentage points';
  }
  function sample(x, y) {
    points[slot] = { x: clamp(x), y: clamp(y) };
    const cx = Math.min(canvas.width - 1, Math.round(canvas.width * points[slot].x));
    const cy = Math.min(canvas.height - 1, Math.round(canvas.height * points[slot].y));
    const left = Math.max(0, cx - 6), top = Math.max(0, cy - 6);
    values[slot] = meanLightness(ctx.getImageData(left, top, Math.min(13, canvas.width - left), Math.min(13, canvas.height - top)).data);
    status.textContent = values[slot] === null ? 'Move the marker onto the photo.' :
      SAMPLE_LABELS[slot] + ' sample · ' + values[slot].toFixed(1) + '% luminance.';
    render();
  }
  function move(x, y) { sample(points[slot].x + x, points[slot].y + y); }
  entries.forEach((button, index) => button.addEventListener('click', () => { slot = index; status.textContent = ''; render(); }));
  surface.addEventListener('click', event => {
    const rect = surface.getBoundingClientRect();
    sample((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  });
  find('#tone-measure').addEventListener('click', () => move(0, 0));
  for (const button of root.querySelectorAll('[data-tone-move]')) {
    const [x, y] = button.dataset.toneMove.split(',').map(Number);
    button.addEventListener('click', () => move(x, y));
  }
  surface.addEventListener('keydown', event => {
    const offsets = { ArrowLeft: [-.025, 0], ArrowRight: [.025, 0], ArrowUp: [0, -.025], ArrowDown: [0, .025], Enter: [0, 0], ' ': [0, 0] };
    if (!Object.hasOwn(offsets, event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    move(...offsets[event.key]);
  });
  find('#grayscale').addEventListener('change', event => canvas.classList.toggle('gray', event.target.checked));
  function showExample(key) {
    const { a, b, text } = examples[key];
    const pair = find('#tone-example');
    root.style.setProperty('--tone-a', a);
    root.style.setProperty('--tone-b', b);
    pair.querySelector('p').textContent = text;
    for (const button of root.querySelectorAll('[data-tone-example]')) button.setAttribute('aria-pressed', String(button.dataset.toneExample === key));
  }
  for (const button of root.querySelectorAll('[data-tone-example]')) {
    button.addEventListener('click', () => showExample(button.dataset.toneExample));
  }
  keepButton.addEventListener('click', () => {
    keep(values.map(value => Math.round(value * 10) / 10));
    status.textContent = 'Reading added to your session report.';
  });
  root.addEventListener('close', () => { if (!root.open) ctx.clearRect(0, 0, canvas.width, canvas.height); });
  showExample('light');
  return () => {
    points = initialPoints.slice(); values = [null, null, null]; slot = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    capture.copyTo(canvas);
    status.textContent = '';
    render();
    root.showModal();
  };
}
