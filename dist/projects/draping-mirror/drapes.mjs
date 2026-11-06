import { normalizeHex, toOKLCH, sample } from './color.mjs';

export const PALETTE_KEY = 'julieowens.draping-mirror.palette.v1';
export const DEFAULT_FRAME = Object.freeze({ x: 0.5, y: 0.42, zoom: 1 });

// Keep the requested lightness and hue; reduce chroma until it fits sRGB.
// All explanations are calculated again from the final quantized hex colors.
export function fitColor(lightness, chroma, hue) {
  lightness = Math.max(0, Math.min(1, lightness));
  chroma = Math.max(0, chroma);
  const direct = sample(lightness, chroma, hue);
  if (direct) return { hex: direct, fitted: false };
  let low = 0, high = chroma;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2;
    if (sample(lightness, middle, hue)) low = middle;
    else high = middle;
  }
  return { hex: sample(lightness, low, hue), fitted: true };
}

export const STUDIES = Object.freeze({
  reds: { names: ['Cranberry', 'Clay'], colors: ['#8C244A', '#B86B46'], description: 'Two different reds. Hue, lightness and intensity all change; explore the combined effect.' },
  depth: { names: ['Deep teal', 'Light teal'], colors: [fitColor(.36, .055, 190).hex, fitColor(.76, .055, 190).hex], description: 'Similar hue and chroma, different lightness. Compare how the darker and lighter framing feels.' },
  intensity: { names: ['Muted plum', 'Vivid plum'], colors: [fitColor(.52, .035, 325).hex, fitColor(.52, .18, 325).hex], description: 'Similar hue and lightness, different chroma. Explore softness and intensity.' },
  neutrals: { names: ['Soft black', 'Ivory'], colors: ['#242328', '#E8E2D4'], description: 'A broad light–dark comparison. The ivory also has a warmer hue; this is not a test of just one property.' },
  greens: { names: ['Emerald', 'Olive'], colors: ['#126C54', '#77723A'], description: 'Two green directions. This pair changes hue, lightness and chroma together.' },
  custom: { names: ['Your color', 'Your color'], description: 'Choose any two colors, or fine-tune one property at a time.' }
});

export function compareColors(a, b) {
  const first = toOKLCH(a), second = toOKLCH(b);
  const lightness = (second.lightness - first.lightness) * 100;
  const chroma = second.chroma - first.chroma;
  const lightnessText = Math.abs(lightness) < 1 ? 'The drapes have similar lightness.' : `B is ${Math.abs(lightness).toFixed(1)} lightness points ${lightness > 0 ? 'lighter' : 'darker'} than A.`;
  const chromaText = Math.abs(chroma) < .005 ? 'Their chroma is similar.' : `B has ${chroma > 0 ? 'more' : 'less'} chroma than A (${Math.abs(chroma).toFixed(3)} difference).`;
  return { first, second, lightness, chroma, lightnessText, chromaText };
}

// A shared source crop for both drapes. Bounds never include blank pixels.
export function portraitCrop(width, height, frame) {
  const aspect = 280 / 370;
  const cropHeight = Math.min(height, width / aspect) / Math.max(.7, frame.zoom);
  const cropWidth = cropHeight * aspect;
  const scale = Math.min(1, width / cropWidth, height / cropHeight);
  const w = cropWidth * scale, h = cropHeight * scale;
  return { x: Math.max(0, Math.min(width - w, frame.x * width - w / 2)), y: Math.max(0, Math.min(height - h, frame.y * height - h / 2)), width: w, height: h };
}

export function landmarkFrame(landmarks, width, height) {
  if (!landmarks?.length) return null;
  const xs = landmarks.map(p => p.x), ys = landmarks.map(p => p.y);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const faceHeight = bottom - top;
  if (!Number.isFinite(faceHeight) || faceHeight < .03) return null;
  const cropHeight = faceHeight * height * 1.45;
  const fullHeight = Math.min(height, width / (280 / 370));
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (top + bottom) / 2 - faceHeight * .06, zoom: Math.max(.7, Math.min(4, fullHeight / cropHeight)) };
}

export function samplePosition(x, y) {
  const distance = Math.hypot((x - .5) / .46, (y - .5) / .46);
  return distance > 1 ? { x: .5 + (x - .5) / distance, y: .5 + (y - .5) / distance } : { x, y };
}

export function readPalette(raw) {
  const parsed = JSON.parse(raw ?? '[]');
  if (!Array.isArray(parsed)) throw new TypeError('Invalid palette');
  return [...new Set(parsed.filter(value => typeof value === 'string').map(normalizeHex).filter(Boolean))].slice(0, 20);
}
