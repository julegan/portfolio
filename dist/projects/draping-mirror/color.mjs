// Personal-color coordinates for Draping mirror. CSS Color 4 / Oklab matrices.
export function normalizeHex(value) {
  const match = String(value).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const digits = match[1];
  return '#' + (digits.length === 3 ? digits.replace(/./g, '$&$&') : digits).toUpperCase();
}

const linearChannels = Float64Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});

function linearRGB(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new TypeError('Expected an opaque sRGB hex color.');
  return normalized.slice(1).match(/../g).map(pair => linearChannels[parseInt(pair, 16)]);
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
export function sampleRGB(lightness, chroma, hue) {
  if (![lightness, chroma, hue].every(Number.isFinite) || lightness < 0 || lightness > 1 || chroma < 0) return null;
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.2914855480 * b;
  const l = lRoot * lRoot * lRoot;
  const m = mRoot * mRoot * mRoot;
  const s = sRoot * sRoot * sRoot;
  const rgb = [
    4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
  ];
  if (rgb.some(channel => channel < -1e-6 || channel > 1.000001)) return null;
  return rgb.map(channel => {
    const c = Math.max(0, Math.min(1, channel));
    const encoded = c <= 0.0031308 ? 12.92*c : 1.055*c**(1/2.4) - 0.055;
    return Math.round(255*encoded);
  });
}

export function sample(lightness, chroma, hue) {
  const rgb = sampleRGB(lightness, chroma, hue);
  return rgb && '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
}
