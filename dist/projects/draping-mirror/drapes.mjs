import { normalizeHex, sample } from './color.mjs';

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

export function readPalette(raw) {
  const parsed = JSON.parse(raw ?? '[]');
  if (!Array.isArray(parsed)) throw new TypeError('Invalid palette');
  return [...new Set(parsed.filter(value => typeof value === 'string').map(normalizeHex).filter(Boolean))].slice(0, 64);
}
