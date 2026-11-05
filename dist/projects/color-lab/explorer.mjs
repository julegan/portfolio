import { sample, toOKLCH, contrast } from './engine.mjs';

export function colorPoint(hex) {
  const color = toOKLCH(hex);
  const radians = color.hue * Math.PI / 180;
  return [
    2 * color.chroma * Math.cos(radians),
    2 * (color.lightness - 0.5),
    2 * color.chroma * Math.sin(radians)
  ];
}

export function colorSamples(hue) {
  const slice = Number.isFinite(hue);
  const lightnessSteps = slice ? 80 : 40;
  const chromaSteps = slice ? 32 : 20;
  const hues = slice ? [hue] : Array.from({ length: 48 }, (_, index) => index * 7.5);
  const colors = new Map();
  for (let row = 0; row <= lightnessSteps; row++) {
    for (let column = 0; column <= chromaSteps; column++) {
      for (const angle of column === 0 ? [0] : hues) {
        const hex = sample(row / lightnessSteps, column / chromaSteps * 0.4, angle);
        if (hex && !colors.has(hex)) colors.set(hex, { hex, point: colorPoint(hex) });
      }
    }
  }
  return [...colors.values()];
}

export function projector(camera, width, height) {
  const cosRotation = Math.cos(camera.rotation);
  const sinRotation = Math.sin(camera.rotation);
  const cosTilt = Math.cos(camera.tilt);
  const sinTilt = Math.sin(camera.tilt);
  const scale = Math.min(width * 0.48, height * 0.31) * camera.zoom;
  return point => {
    const x = cosRotation * point[0] + sinRotation * point[2];
    const z = -sinRotation * point[0] + cosRotation * point[2];
    const y = cosTilt * point[1] - sinTilt * z;
    const depth = sinTilt * point[1] + cosTilt * z;
    const perspective = 4 / (4 - depth);
    return { x: width / 2 + x * scale * perspective, y: height / 2 - y * scale * perspective, depth, perspective };
  };
}

const radians = degrees => degrees * Math.PI / 180;
const degrees = angle => angle * 180 / Math.PI;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const wrapRotation = angle => ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

export function createExplorer(canvas, onSelect) {
  const byId = id => document.getElementById(id);
  const context = canvas.getContext('2d');
  const camera = { rotation: radians(-80), tilt: radians(20), zoom: 1 };
  const pointers = new Map();
  let props = null;
  let volume = null;
  let slice = [];
  let sliceHue = null;
  let contrastKey = null;
  let projected = [];
  let frameRequested = false;
  let moved = false;
  let pointerTravel = 0;
  let pinchDistance = null;

  function syncCamera() {
    for (const [name, value, unit] of [
      ['rotation', Math.round(degrees(camera.rotation)), '°'],
      ['tilt', Math.round(degrees(camera.tilt)), '°'],
      ['zoom', Math.round(camera.zoom * 100), '%']
    ]) {
      byId(name).value = value;
      byId(name + '-value').value = value + unit;
      byId(name).setAttribute('aria-valuetext', value + (unit === '°' ? ' degrees' : ' percent'));
    }
  }

  function line(project, points, color, dashed = false) {
    context.beginPath();
    points.forEach((point, index) => {
      const screen = project(point);
      if (index === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    });
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.setLineDash(dashed ? [4, 4] : []);
    context.stroke();
    context.setLineDash([]);
  }

  function label(project, point, text, align = 'center') {
    const screen = project(point);
    context.font = '12px system-ui, sans-serif';
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillStyle = '#CFCCD5';
    context.fillText(text, screen.x, screen.y);
  }

  function draw() {
    frameRequested = false;
    if (!props?.active) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(2, Math.round(bounds.width * pixelRatio));
    const height = Math.max(2, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    const project = projector(camera, bounds.width, bounds.height);
    const ring = Array.from({ length: 73 }, (_, index) => {
      const angle = index / 72 * Math.PI * 2;
      return [0.8 * Math.cos(angle), -1, 0.8 * Math.sin(angle)];
    });
    line(project, ring, '#4E4A55');
    line(project, [[0, -1, 0], [0, 1, 0]], '#65616D');
    line(project, [[-0.8, -1, 0], [0.8, -1, 0]], '#39363F');
    line(project, [[0, -1, -0.8], [0, -1, 0.8]], '#39363F');

    const angle = radians(props.hue);
    const edge = [0.8 * Math.cos(angle), 0, 0.8 * Math.sin(angle)];
    const plane = [[0, -1, 0], [edge[0], -1, edge[2]], [edge[0], 1, edge[2]], [0, 1, 0], [0, -1, 0]];
    line(project, plane, '#8C8696', true);

    const source = byId('isolate-slice').checked ? [] : volume;
    const showExcluded = byId('show-excluded').checked;
    projected = [];
    for (const [samples, isSlice] of [[source, false], [slice, true]]) {
      for (const color of samples) {
        if (!color.passing && !showExcluded) continue;
        const screen = project(color.point);
        projected.push({ ...screen, color, radius: (isSlice ? 2.8 : 1.8) * screen.perspective });
      }
    }
    projected.sort((first, second) => first.depth - second.depth);
    for (const point of projected) {
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fillStyle = point.color.passing ? point.color.hex : '#494550';
      context.fill();
    }
    line(project, plane, '#A9A2B2', true);
    label(project, [0, 1.17, 0], 'Lightness 1 · white');
    label(project, [0, -1.2, 0], 'Lightness 0 · black');
    for (const hue of [0, 90, 180, 270]) {
      const angle = radians(hue);
      label(project, [0.94 * Math.cos(angle), -1, 0.94 * Math.sin(angle)], hue + '°');
    }
    const selected = project(colorPoint(props.selected));
    context.beginPath();
    context.arc(selected.x, selected.y, 7, 0, Math.PI * 2);
    context.fillStyle = props.selected;
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = '#101013';
    context.stroke();
    context.lineWidth = 2;
    context.strokeStyle = '#FFFFFF';
    context.stroke();
  }

  function requestDraw() {
    if (frameRequested || !props?.active) return;
    frameRequested = true;
    requestAnimationFrame(draw);
  }

  function updateStatus() {
    if (!volume) return;
    const samples = byId('isolate-slice').checked ? slice : volume;
    const passing = samples.filter(color => color.passing).length;
    byId('space-status').textContent = passing.toLocaleString() + ' of ' + samples.length.toLocaleString() +
      ' sampled colors meet the target. Gray samples are below target.';
  }

  function update(next) {
    props = next;
    if (!next.active) return;
    volume ||= colorSamples();
    const key = next.background + ':' + next.target;
    if (key !== contrastKey) {
      for (const color of volume) color.passing = contrast(color.hex, next.background) >= next.target;
    }
    if (sliceHue !== next.hue || key !== contrastKey) {
      slice = colorSamples(next.hue);
      for (const color of slice) color.passing = contrast(color.hex, next.background) >= next.target;
      sliceHue = next.hue;
    }
    contrastKey = key;
    updateStatus();
    requestDraw();
  }

  function pick(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const candidates = projected.filter(point => point.color.passing &&
      Math.hypot(point.x - x, point.y - y) <= point.radius + 3);
    const point = candidates.sort((first, second) => second.depth - first.depth)[0];
    if (point && contrast(point.color.hex, props.background) >= props.target) onSelect(point.color.hex);
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (!pointers.size) {
      moved = false;
      pointerTravel = 0;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
      moved = true;
    }
  });
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (pinchDistance > 0) camera.zoom = clamp(camera.zoom * distance / pinchDistance, 0.6, 1.6);
      pinchDistance = distance;
    } else if (pointers.size === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      pointerTravel += Math.hypot(dx, dy);
      moved ||= pointerTravel > 4;
      if (moved) {
        camera.rotation = wrapRotation(camera.rotation + dx * 0.008);
        camera.tilt = clamp(camera.tilt + dy * 0.008, radians(-75), radians(75));
      }
    }
    syncCamera();
    requestDraw();
  });
  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    if (event.type === 'pointerup' && pointers.size === 1 && !moved) pick(event);
    pointers.delete(event.pointerId);
    pinchDistance = null;
    canvas.style.cursor = pointers.size ? 'grabbing' : 'grab';
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, finishPointer);

  for (const name of ['rotation', 'tilt', 'zoom']) {
    byId(name).addEventListener('input', () => {
      const value = Number(byId(name).value);
      if (name === 'zoom') camera.zoom = value / 100;
      else camera[name] = radians(value);
      syncCamera();
      requestDraw();
    });
  }
  byId('reset-camera').addEventListener('click', () => {
    camera.rotation = radians(-80);
    camera.tilt = radians(20);
    camera.zoom = 1;
    syncCamera();
    requestDraw();
  });
  byId('face-slice').addEventListener('click', () => {
    camera.rotation = wrapRotation(radians(props.hue));
    camera.tilt = 0;
    syncCamera();
    requestDraw();
  });
  for (const name of ['show-excluded', 'isolate-slice']) {
    byId(name).addEventListener('change', () => {
      updateStatus();
      requestDraw();
    });
  }
  new ResizeObserver(requestDraw).observe(canvas);
  function watchPixelRatio() {
    window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)').addEventListener('change', () => {
      requestDraw();
      watchPixelRatio();
    }, { once: true });
  }
  watchPixelRatio();
  syncCamera();
  return { update };
}
