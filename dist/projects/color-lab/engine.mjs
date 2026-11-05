export function normalizeHex(value) {
  const match = String(value).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const digits = match[1];
  return '#' + (digits.length === 3 ? digits.replace(/./g, '$&$&') : digits).toUpperCase();
}

function linearRGB(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new TypeError('Expected an opaque sRGB hex color.');
  return normalized.slice(1).match(/../g).map(pair => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

export function toOKLCH(hex) {
  const [red, green, blue] = linearRGB(hex);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const chroma = Math.hypot(a, b);
  return {
    lightness,
    chroma: chroma < 1e-7 ? 0 : chroma,
    hue: chroma < 1e-7 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360
  };
}

// OKLCH through Oklab to linear sRGB, using the CSS Color 4 matrices.
export function sample(lightness, chroma, hue) {
  if (![lightness, chroma, hue].every(Number.isFinite) || lightness < 0 || lightness > 1 || chroma < 0) return null;
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const rgb = [
    4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
  ];
  if (rgb.some(channel => channel < -1e-6 || channel > 1.000001)) return null;
  const hex = rgb.map(channel => {
    const c = Math.max(0, Math.min(1, channel));
    const encoded = c <= 0.0031308 ? 12.92*c : 1.055*c**(1/2.4) - 0.055;
    return Math.round(255*encoded).toString(16).padStart(2, '0');
  });
  return '#' + hex.join('').toUpperCase();
}

function luminance(hex) {
  const [r, g, b] = linearRGB(hex);
  return 0.2126*r + 0.7152*g + 0.0722*b;
}

export function nearbyShade(hex, background, target) {
  if (contrast(hex, background) >= target) return normalizeHex(hex);
  const original = toOKLCH(hex);
  let best = null;
  let bestDistance = Infinity;
  let bestPosition;

  function consider(lightness, chroma) {
    if (original.chroma === 0 && chroma > 1e-8) return;
    const candidate = sample(lightness, chroma, original.hue);
    if (!candidate || contrast(candidate, background) < target) return;
    const distance = (lightness - original.lightness) ** 2 + (chroma - original.chroma) ** 2;
    if (distance >= bestDistance) return;
    best = candidate;
    bestDistance = distance;
    bestPosition = { lightness, chroma };
  }

  // Search both light and dark regions, then refine the closest sampled region.
  // At a fixed hue, this distance is the Euclidean distance in Oklab.
  for (let row = 0; row <= 100; row++) {
    for (let column = 0; column <= 80; column++) {
      consider(row / 100, column / 200);
    }
  }
  if (!best) return null;
  const center = bestPosition;
  for (let row = -10; row <= 10; row++) {
    for (let column = -10; column <= 10; column++) {
      consider(center.lightness + row * 0.001, center.chroma + column * 0.0005);
    }
  }
  return best;
}
export function contrast(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
}
