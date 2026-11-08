// Keep one proportional portrait composition while the fabric fills its frame.
export function mirrorLayout(width, height, density = 2) {
  const scale = Math.min(width / 480, height / 600);
  const left = (width - 480 * scale) / 2;
  const pixels = Math.min(density, 4096 / Math.max(width, height));
  return {
    width, height, scale, left,
    pixelWidth: Math.max(1, Math.round(width * pixels)),
    pixelHeight: Math.max(1, Math.round(height * pixels)),
    portrait: { x: left + 60 * scale, y: 10 * scale, width: 360 * scale, height: 476 * scale }
  };
}
