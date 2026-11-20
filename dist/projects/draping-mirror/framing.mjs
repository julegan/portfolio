import { DEFAULT_FRAME, portraitCrop } from './drapes.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const radians = degrees => degrees * Math.PI / 180;
const rotate = ({ x, y }, angle) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle)
});

export function normalizeFrame(frame) {
  return {
    x: clamp(Number.isFinite(frame.x) ? frame.x : DEFAULT_FRAME.x, 0, 1),
    y: clamp(Number.isFinite(frame.y) ? frame.y : DEFAULT_FRAME.y, 0, 1),
    zoom: clamp(Number.isFinite(frame.zoom) ? frame.zoom : 1, .7, 4),
    rotation: Number.isFinite(frame.rotation) ? ((frame.rotation % 360 + 540) % 360) - 180 : 0
  };
}

// Keep the pixel under the gesture midpoint anchored as the frame changes.
// Coordinates are in the 560 × 740 portrait, prior to the oval mask.
export function transformFrame(frame, { width, height, mirrored }, from, to, ratio = 1, turn = 0) {
  const oldCrop = portraitCrop(width, height, frame);
  const next = normalizeFrame({ ...frame, zoom: frame.zoom * ratio, rotation: (frame.rotation ?? 0) + turn });
  const newCrop = portraitCrop(width, height, next);
  const point = (position, crop, angle) => {
    const local = rotate({ x: position.x - 280, y: position.y - 370 }, -radians(angle));
    return { x: local.x * crop.width / 560 * (mirrored ? -1 : 1), y: local.y * crop.height / 740 };
  };
  const a = point(from, oldCrop, frame.rotation ?? 0), b = point(to, newCrop, next.rotation);
  return normalizeFrame({
    ...next,
    x: (oldCrop.x + oldCrop.width / 2 + a.x - b.x) / width,
    y: (oldCrop.y + oldCrop.height / 2 + a.y - b.y) / height
  });
}

export function attachFraming(surface, move, bounds) {
  const pointers = new Map();
  const enabled = () => surface.classList.contains('is-framing');
  const clear = () => {
    for (const id of pointers.keys()) if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    pointers.clear();
  };
  const metric = () => {
    const [a, b] = pointers.values();
    if (!b) return { point: a };
    return {
      point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
    };
  };
  function location(event) {
    const { left, top, width, height } = bounds();
    return { x: (event.clientX - left) * 560 / width, y: (event.clientY - top) * 740 / height };
  }
  surface.addEventListener('pointerdown', event => {
    if (!enabled() || event.button !== 0 || pointers.size >= 2) return;
    pointers.set(event.pointerId, location(event));
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener('pointermove', event => {
    if (!enabled() || !pointers.has(event.pointerId)) return;
    const from = metric();
    pointers.set(event.pointerId, location(event));
    const to = metric();
    const pinch = from.distance > 4 && to.distance > 4;
    move(from.point, to.point, pinch ? to.distance / from.distance : 1, pinch ? to.angle - from.angle : 0);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => pointers.delete(event.pointerId));
  }
  const nudge = {
    ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30],
    '+': [0, 0, 1.15], '=': [0, 0, 1.15], '-': [0, 0, 1 / 1.15],
    '[': [0, 0, 1, -5], ']': [0, 0, 1, 5]
  };
  const adjust = (x, y, zoom = 1, angle = 0) => move({ x: 280, y: 370 }, { x: 280 + x, y: 370 + y }, zoom, angle);
  return { adjust, clear, keyboard(event) {
    if (!enabled() || event.ctrlKey || event.metaKey || event.altKey || !Object.hasOwn(nudge, event.key)) return;
    event.preventDefault();
    adjust(...nudge[event.key]);
  } };
}
