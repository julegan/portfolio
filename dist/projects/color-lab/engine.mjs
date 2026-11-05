// OKLCH through Oklab to linear sRGB, using the CSS Color 4 matrices.
export function sample(lightness, chroma, hue) {
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
  if (rgb.some(channel => channel < -1e-7 || channel > 1.0000001)) return null;
  const hex = rgb.map(channel => {
    const c = Math.max(0, Math.min(1, channel));
    const encoded = c <= 0.0031308 ? 12.92*c : 1.055*c**(1/2.4) - 0.055;
    return Math.round(255*encoded).toString(16).padStart(2, '0');
  });
  return '#' + hex.join('').toUpperCase();
}

function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map(pair => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
export function contrast(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
}
