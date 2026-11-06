import { normalizeHex, toOKLCH } from './color.mjs';
import { PALETTE_KEY, DEFAULT_FRAME, STUDIES, fitColor, compareColors, portraitCrop, landmarkFrame, readPalette, samplePosition } from './drapes.mjs';

const $ = id => document.getElementById(id);
const video = $('camera');
const panels = [$('portrait-a'), $('portrait-b')];
// Personal image data lives only in these in-memory canvases, never storage.
const photo = document.createElement('canvas');
const liveFrame = document.createElement('canvas');
const portrait = document.createElement('canvas');
portrait.width = 560; portrait.height = 740;
liveFrame.width = 0; liveFrame.height = 0;
let mode = 'empty', stream = null, frame = { ...DEFAULT_FRAME }, manualFrame = false;
let colors = [...STUDIES.reds.colors], names = [...STUDIES.reds.names];
let palette = [], storageAvailable = true, inspecting = false;
let operation = 0, animation = 0, trackerPromise, tracker = null, lastDetection = 0, lastPaint = 0;
const votes = new Map();
const status = message => { $('source-status').textContent = message; };
const trackingStatus = message => { if ($('tracking-status').textContent !== message) $('tracking-status').textContent = message; };
const hasPortrait = () => mode !== 'empty';
const pairKey = () => colors.join('/');
const samplePoint = () => samplePosition(Number($('sample-x').value) / 100, Number($('sample-y').value) / 100);

function releaseCamera() {
  cancelAnimationFrame(animation);
  animation = 0;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.pause(); video.srcObject = null;
}

function sourceControls() {
  $('freeze').disabled = mode !== 'camera' || !liveFrame.width;
  $('clear').disabled = mode === 'empty';
  $('download-comparison').disabled = !hasPortrait() || mode === 'camera';
  $('inspect').disabled = !hasPortrait() || mode === 'camera';
  $('auto-frame').disabled = !hasPortrait() || mode === 'demo';
  $('start-camera').disabled = mode === 'camera';
  $('source-tag').textContent = { demo: 'Illustrated sample', photo: 'Your photo · session only', camera: 'Live camera', frozen: 'Frozen frame · camera off', empty: 'No portrait' }[mode];
}

function frameControls() {
  $('frame-x').value = frame.x * 100;
  $('frame-y').value = frame.y * 100;
  $('frame-scale').value = frame.zoom * 100;
}

function drawPanel(canvas, color) {
  const ctx = canvas.getContext('2d');
  // A fixed 2x backing store keeps both portrait windows pixel-identical.
  if (canvas.width !== 960) { canvas.width = 960; canvas.height = 1200; }
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, 480, 600);
  ctx.fillStyle = '#D4D1CC'; ctx.fillRect(0, 0, 480, 600);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 352); ctx.quadraticCurveTo(240, 267, 480, 352); ctx.lineTo(480, 600); ctx.lineTo(0, 600); ctx.closePath(); ctx.fill();
  // The same unmodified image is clipped into the same oval in both views.
  ctx.save(); ctx.beginPath(); ctx.ellipse(240, 216, 140, 185, 0, 0, Math.PI * 2); ctx.clip();
  // Transparent PNG areas get an identical neutral backing, including where
  // the window overlaps the drape. A drape must never bleed into the portrait.
  ctx.fillStyle = '#D4D1CC'; ctx.fillRect(100, 31, 280, 370);
  if (hasPortrait()) ctx.drawImage(portrait, 100, 31, 280, 370);
  else {
    ctx.fillStyle = '#39373D'; ctx.fillRect(100, 31, 280, 370);
    ctx.fillStyle = '#DFDCE5'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Add a portrait', 240, 215);
  }
  ctx.restore();
  ctx.strokeStyle = '#151518'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(240, 216, 140, 185, 0, 0, Math.PI * 2); ctx.stroke();
  if (inspecting && hasPortrait() && mode !== 'camera') {
    const point = samplePoint();
    const x = 100 + point.x * 280;
    const y = 31 + point.y * 370;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.strokeStyle = '#FFF'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#151518'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function paint() {
  if (hasPortrait()) {
    const source = mode === 'camera' ? liveFrame : photo;
    if (source.width > 0 && source.height > 0) {
      const crop = portraitCrop(source.width, source.height, frame);
      const ctx = portrait.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, portrait.width, portrait.height);
      ctx.save();
      // Front camera behaves like a mirror, including in the frozen image.
      if (mode === 'camera' || mode === 'frozen') { ctx.translate(portrait.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, portrait.width, portrait.height);
      ctx.restore();
    }
  }
  panels.forEach((panel, index) => drawPanel(panel, colors[index]));
  featureAnalysis();
}

function featureAnalysis() {
  const show = inspecting && hasPortrait() && mode !== 'camera';
  $('feature-comparison').hidden = !show;
  if (!show) return;
  const position = samplePoint();
  const x = Math.round(position.x * (portrait.width - 1));
  const y = Math.round(position.y * (portrait.height - 1));
  const pixels = portrait.getContext('2d', { willReadFrequently: true }).getImageData(x - 2, y - 2, 5, 5).data;
  const rgb = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) rgb.forEach((_, channel) => { rgb[channel] += pixels[i + channel]; });
  const hex = '#' + rgb.map(channel => Math.round(channel / 25).toString(16).padStart(2, '0')).join('').toUpperCase();
  const point = toOKLCH(hex);
  const gaps = colors.map(color => Math.abs(toOKLCH(color).lightness - point.lightness) * 100);
  $('sample-status').textContent = `Recorded sample: ${hex}${mode === 'demo' ? ' · illustrated sample, not a person' : ''}.`;
  $('feature-comparison').textContent = `Image sample ${hex}: the lightness gap is ${gaps[0].toFixed(1)} points to A and ${gaps[1].toFixed(1)} to B. ${Math.abs(gaps[0] - gaps[1]) < 1 ? 'Both drapes have a similar lightness difference from this sample.' : `${gaps[0] > gaps[1] ? 'A' : 'B'} has the stronger light–dark separation from this sample.`} This describes recorded pixels; it does not measure a change in your face or decide which effect suits you.`;
}

async function loadTracker() {
  if (tracker) return tracker;
  if (!trackerPromise) {
    trackingStatus('Loading face framing on this device… Manual controls remain available.');
    trackerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('./vendor/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks(new URL('vendor/wasm', import.meta.url).href);
      tracker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('vendor/face_landmarker.task', import.meta.url).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false
      });
      return tracker;
    })().catch(error => { trackerPromise = null; throw error; });
  }
  return trackerPromise;
}

function findFrame(source, smooth = false) {
  if (!tracker || manualFrame || mode === 'empty' || mode === 'demo') return;
  const detection = tracker.detectForVideo(source, performance.now());
  const next = landmarkFrame(detection.faceLandmarks[0], source.width, source.height);
  if (next) {
    for (const key of ['x', 'y', 'zoom']) frame[key] = smooth ? frame[key] * .65 + next[key] * .35 : next[key];
    frameControls(); trackingStatus('Face framing is active. Adjusting a framing slider switches to manual control.');
  } else trackingStatus('No single face found. Try facing the camera or use the framing controls.');
}

async function autoFrame() {
  const token = operation;
  manualFrame = false; frame = { ...DEFAULT_FRAME }; frameControls(); paint();
  try {
    await loadTracker();
    if (token !== operation || !hasPortrait()) return;
    findFrame(mode === 'camera' ? liveFrame : photo); paint();
  } catch (_) { trackingStatus('Automatic framing is unavailable here. Use the framing controls to position your portrait.'); }
}

function cameraLoop(now) {
  if (mode !== 'camera') return;
  if (video.readyState >= 2 && now - lastPaint > 45) {
    lastPaint = now;
    const width = Math.min(960, video.videoWidth);
    const height = Math.round(width * video.videoHeight / video.videoWidth);
    if (liveFrame.width !== width || liveFrame.height !== height) { liveFrame.width = width; liveFrame.height = height; }
    liveFrame.getContext('2d').drawImage(video, 0, 0, width, height);
    $('freeze').disabled = false;
    if (now - lastDetection > 180 && tracker && !manualFrame) {
      lastDetection = now;
      try { findFrame(liveFrame, true); } catch (_) { manualFrame = true; trackingStatus('Face tracking paused. Use the framing controls.'); }
    }
    paint();
  }
  animation = requestAnimationFrame(cameraLoop);
}

async function startCamera() {
  const token = ++operation;
  releaseCamera();
  liveFrame.width = 0; liveFrame.height = 0;
  if (!navigator.mediaDevices?.getUserMedia) { status('Camera access needs a supported browser and HTTPS. You can choose a photo instead.'); return; }
  status('Waiting for camera permission…'); $('start-camera').disabled = true; $('clear').disabled = false;
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    if (token !== operation) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired; video.srcObject = acquired;
    acquired.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (mode === 'camera') freezeFrame('Camera connection ended. The last frame is ready to compare.'); }, { once: true }));
    await video.play();
    if (token !== operation) { acquired.getTracks().forEach(track => track.stop()); return; }
    photo.width = 0; photo.height = 0;
    mode = 'camera'; inspecting = false; $('inspect').setAttribute('aria-pressed', 'false');
    manualFrame = false; frame = { ...DEFAULT_FRAME }; frameControls(); sourceControls();
    status('Live mirror. Face the camera in even light; freeze a frame for comparisons and downloads.');
    animation = requestAnimationFrame(cameraLoop);
    loadTracker().then(() => { if (token !== operation) return; trackingStatus('Face framing is ready.'); }).catch(() => { trackingStatus('Face framing could not load. Use the framing controls.'); });
  } catch (error) {
    if (token !== operation) return;
    releaseCamera(); sourceControls();
    status(error.name === 'NotAllowedError' ? 'Camera permission was not granted. You can allow it in browser settings or choose a photo.' : 'The camera could not start. Close other camera apps or choose a photo.');
  }
}

function freezeFrame(message = 'Frame frozen. The camera is off; both drapes use this identical image.') {
  if (mode !== 'camera') return;
  if (!liveFrame.width) { clearPortrait(); status('Camera stopped before a frame was available. Start it again when you’re ready.'); return; }
  photo.width = liveFrame.width; photo.height = liveFrame.height;
  photo.getContext('2d').drawImage(liveFrame, 0, 0);
  releaseCamera(); mode = 'frozen'; ++operation;
  sourceControls(); paint(); status(message);
}

async function choosePhoto(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { status('Choose an image smaller than 20 MB.'); return; }
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) { status('Choose a JPEG, PNG or WebP photo. Convert HEIC to JPEG if your browser cannot open it.'); return; }
  const token = ++operation;
  releaseCamera();
  // Decode directly from the local File. No FormData, fetch or server upload.
  status('Opening your photo on this device…');
  const url = URL.createObjectURL(file);
  let image;
  try {
    image = new Image(); image.src = url; await image.decode();
    if (token !== operation) return;
    const factor = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    photo.width = Math.max(1, Math.round(image.naturalWidth * factor)); photo.height = Math.max(1, Math.round(image.naturalHeight * factor));
    photo.getContext('2d').drawImage(image, 0, 0, photo.width, photo.height);
    mode = 'photo'; frame = { ...DEFAULT_FRAME }; manualFrame = false;
    sourceControls(); frameControls(); paint();
    status('Your photo is ready. It stays in this session; clear it at any time.');
    autoFrame();
  } catch (_) {
    if (token !== operation) return;
    // A previously live source has been stopped, so never leave a live UI behind.
    if (mode === 'camera') clearPortrait();
    sourceControls(); status('This image could not be opened. Try a JPEG, PNG or WebP photo.');
  } finally { URL.revokeObjectURL(url); if (image) image.src = ''; }
}

function clearPortrait() {
  ++operation; releaseCamera(); mode = 'empty'; inspecting = false;
  photo.width = 0; photo.height = 0; liveFrame.width = 0; liveFrame.height = 0;
  portrait.getContext('2d').clearRect(0, 0, portrait.width, portrait.height);
  $('photo').value = ''; $('inspect').setAttribute('aria-pressed', 'false');
  $('sample-status').textContent = 'The portrait and its sample have been cleared.';
  sourceControls(); paint(); status('Portrait cleared. Your saved colors do not contain a photo.');
}

function preference() {
  const chosen = votes.get(pairKey());
  document.querySelectorAll('[data-vote]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.vote === chosen)));
  const text = { a: 'You preferred A for this pair.', b: 'You preferred B for this pair.', both: 'You liked both options.', unsure: 'You’re still exploring this pair.' }[chosen];
  $('preference-status').textContent = text ? `${text} This impression stays in this session.` : 'There is no score to chase. Look for the effect you want.';
}

function explain() {
  const result = compareColors(...colors);
  $('measured-heading').textContent = Math.abs(result.lightness) > 8 ? 'Notice the light–dark difference' : Math.abs(result.chroma) > .015 ? 'Notice the change in intensity' : 'Look for the smaller differences';
  $('measured-body').textContent = `${result.lightnessText} ${result.chromaText} These are properties of the drapes, calculated from their final colors.`;
  $('color-measurements').textContent = result.first && ['A', 'B'].map((side, i) => {
    const point = i ? result.second : result.first;
    return `${side} ${colors[i]}\nL ${(point.lightness * 100).toFixed(1)} · C ${point.chroma.toFixed(3)} · h ${point.chroma < .005 ? 'neutral' : point.hue.toFixed(1) + '°'}`;
  }).join('\n\n');
  $('suggestion-heading').textContent = Math.abs(result.lightness) > 8 ? 'Which framing do you want?' : 'Try changing just the intensity';
  $('suggestion-body').textContent = Math.abs(result.lightness) > 8 ? 'Compare the lighter and deeper framing. Does one bring the emphasis you want to your face? Use the feature sample to inspect light–dark separation. Stronger separation is an effect to explore, not a higher score.' : 'Compare the quieter and more vivid framing. Surrounding colors can influence how the same face appears. Match B’s hue and lightness to A to focus the comparison on chroma.';
  featureAnalysis();
}

function syncColors(syncSliders = true) {
  ['a', 'b'].forEach((side, index) => {
    $('color-' + side).value = colors[index]; $('hex-' + side).value = colors[index];
    $('caption-' + side).textContent = names[index]; $('code-' + side).textContent = colors[index];
    $('hex-' + side).removeAttribute('aria-invalid');
  });
  if (syncSliders) {
    const point = toOKLCH(colors[$('edit-side').value === 'a' ? 0 : 1]);
    $('drape-lightness').value = point.lightness; $('drape-chroma').value = point.chroma;
  }
  const point = toOKLCH(colors[$('edit-side').value === 'a' ? 0 : 1]);
  $('lightness-value').textContent = (point.lightness * 100).toFixed(1);
  $('chroma-value').textContent = point.chroma.toFixed(3);
  $('pair-description').textContent = STUDIES[$('pair-study').value].description;
  $('color-error').textContent = '';
  preference(); explain(); paint();
}

function setColor(index, value) {
  const normalized = normalizeHex(value);
  if (!normalized) { $('hex-' + (index ? 'b' : 'a')).setAttribute('aria-invalid', 'true'); $('color-error').textContent = 'Enter a hex color with 3 or 6 digits, such as #126C54.'; return; }
  colors[index] = normalized; names[index] = 'Your color'; $('pair-study').value = 'custom'; syncColors();
}

function paletteView() {
  $('palette').replaceChildren();
  $('download-palette').disabled = palette.length === 0;
  if (!palette.length && !$('palette-status').textContent) $('palette-status').textContent = 'Keep a color from either drape to start your palette.';
  for (const color of palette) {
    const chip = document.createElement('div'); chip.className = 'palette-chip';
    const swatch = document.createElement('span'); swatch.className = 'chip-color'; swatch.style.backgroundColor = color;
    const label = document.createElement('p'); label.textContent = color;
    const actions = document.createElement('div'); actions.className = 'chip-actions';
    const use = document.createElement('button'); use.type = 'button'; use.className = 'quiet'; use.textContent = 'Use'; use.setAttribute('aria-label', `Use ${color} for drape ${$('edit-side').value.toUpperCase()}`);
    use.addEventListener('click', () => setColor($('edit-side').value === 'a' ? 0 : 1, color));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'quiet'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${color} from palette`);
    remove.addEventListener('click', () => { palette = palette.filter(value => value !== color); persistPalette(); paletteView(); $('palette-status').textContent = `Removed ${color}.`; $('download-palette').focus(); });
    actions.append(use, remove); chip.append(swatch, label, actions); $('palette').append(chip);
  }
}

function persistPalette() {
  if (storageAvailable) {
    try { localStorage.setItem(PALETTE_KEY, JSON.stringify(palette)); }
    catch (_) { storageAvailable = false; }
  }
  $('palette-status').textContent = storageAvailable ? 'Colors saved in this browser. No portrait is saved.' : 'Browser storage is unavailable. Colors will last for this session; download the palette to keep them.';
}

function keep(index) {
  if (palette.includes(colors[index])) { $('palette-status').textContent = 'That color is already in your palette.'; return; }
  if (palette.length >= 20) { $('palette-status').textContent = 'Your palette has 20 colors. Remove one before adding another.'; return; }
  palette.push(colors[index]); persistPalette(); paletteView();
}

function download(blob, filename) {
  if (!blob) { status('The download could not be created. Try again.'); return; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

$('start-camera').addEventListener('click', startCamera);
$('freeze').addEventListener('click', () => freezeFrame());
$('clear').addEventListener('click', clearPortrait);
$('photo').addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; choosePhoto(file); });
$('auto-frame').addEventListener('click', autoFrame);
for (const id of ['frame-x', 'frame-y', 'frame-scale']) $(id).addEventListener('input', () => {
  manualFrame = true; frame = { x: Number($('frame-x').value) / 100, y: Number($('frame-y').value) / 100, zoom: Number($('frame-scale').value) / 100 };
  trackingStatus('Manual framing. Use “Find face & reset framing” to return to automatic framing.'); paint();
});
$('pair-study').addEventListener('change', () => {
  const study = STUDIES[$('pair-study').value];
  if (study.colors) { colors = [...study.colors]; names = [...study.names]; }
  syncColors(); $('gamut-status').textContent = 'Adjust one property to explore its effect.';
});
for (const [index, side] of ['a', 'b'].entries()) {
  $('color-' + side).addEventListener('input', event => setColor(index, event.target.value));
  $('hex-' + side).addEventListener('change', event => setColor(index, event.target.value));
}
$('edit-side').addEventListener('change', () => { syncColors(); paletteView(); });
for (const id of ['drape-lightness', 'drape-chroma']) $(id).addEventListener('input', () => {
  const index = $('edit-side').value === 'a' ? 0 : 1;
  const point = toOKLCH(colors[index]);
  const fitted = fitColor(Number($('drape-lightness').value), Number($('drape-chroma').value), point.hue);
  colors[index] = fitted.hex; names[index] = 'Your color'; $('pair-study').value = 'custom';
  syncColors(false);
  $('gamut-status').textContent = fitted.fitted ? 'Intensity was reduced to keep this hue and lightness inside sRGB. The numbers show the displayed color.' : 'The requested color fits inside sRGB.';
});
$('isolate-chroma').addEventListener('click', () => {
  const a = toOKLCH(colors[0]), b = toOKLCH(colors[1]);
  const fitted = fitColor(a.lightness, b.chroma, a.hue);
  setColor(1, fitted.hex);
  $('gamut-status').textContent = fitted.fitted ? 'B now matches A’s hue and lightness approximately; its chroma was reduced to fit sRGB.' : 'B now matches A’s hue and lightness approximately, retaining its own chroma.';
});
document.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', () => { votes.set(pairKey(), button.dataset.vote); preference(); }));
$('show-numbers').addEventListener('click', () => {
  const expanded = $('show-numbers').getAttribute('aria-expanded') !== 'true';
  $('show-numbers').setAttribute('aria-expanded', String(expanded)); $('color-measurements').hidden = !expanded;
  $('show-numbers').textContent = expanded ? 'Hide the numbers' : 'Show the numbers';
});
$('inspect').addEventListener('click', () => {
  inspecting = !inspecting; $('inspect').setAttribute('aria-pressed', String(inspecting));
  $('portrait-a').dataset.inspecting = String(inspecting); paint();
});
for (const id of ['sample-x', 'sample-y']) $(id).addEventListener('input', paint);
$('portrait-a').addEventListener('click', event => {
  if (!inspecting || mode === 'camera') return;
  const box = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width * 480 - 100) / 280;
  const y = ((event.clientY - box.top) / box.height * 600 - 31) / 370;
  if (((x - .5) / .5) ** 2 + ((y - .5) / .5) ** 2 > 1) return;
  $('sample-x').value = Math.max(15, Math.min(85, x * 100)); $('sample-y').value = Math.max(12, Math.min(83, y * 100)); paint();
});
$('save-a').addEventListener('click', () => keep(0)); $('save-b').addEventListener('click', () => keep(1));
$('download-palette').addEventListener('click', () => download(new Blob([JSON.stringify({ format: 'draping-mirror-palette', version: 1, colors: palette }, null, 2)], { type: 'application/json' }), 'draping-mirror-palette.json'));
$('download-comparison').addEventListener('click', () => {
  if (mode === 'camera' || !hasPortrait()) return;
  // Render fresh, without the inspection markers, before exporting.
  const prior = inspecting; inspecting = false; paint();
  const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1320;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#151518'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(panels[0], 0, 0); ctx.drawImage(panels[1], 960, 0);
  ctx.fillStyle = '#F3F1EC'; ctx.font = '26px system-ui'; ctx.fillText(`A · ${colors[0]}`, 30, 1245); ctx.fillText(`B · ${colors[1]}`, 990, 1245);
  ctx.fillStyle = '#CFCCD5'; ctx.font = '22px system-ui'; ctx.fillText(`Draping mirror · ${mode === 'demo' ? 'Illustrated sample' : 'Same portrait in both views'} · Virtual draping preview`, 30, 1290);
  canvas.toBlob(blob => { download(blob, 'draping-mirror-comparison.png'); canvas.width = 0; canvas.height = 0; }, 'image/png');
  inspecting = prior; paint(); status('Comparison prepared for download. Your portrait has not been uploaded.');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'camera') freezeFrame('Camera stopped while this page was in the background. Your last frame is ready to compare.');
    else { ++operation; releaseCamera(); sourceControls(); }
  }
});
window.addEventListener('pagehide', () => { clearPortrait(); tracker?.close(); tracker = null; trackerPromise = null; });

try { palette = readPalette(localStorage.getItem(PALETTE_KEY)); }
catch (_) {
  try { localStorage.getItem(PALETTE_KEY); $('palette-status').textContent = 'The saved palette could not be read. You can start a new palette.'; }
  catch (_) { storageAvailable = false; $('palette-status').textContent = 'Browser storage is unavailable. You can still explore and download your palette.'; }
}
paletteView(); syncColors(); sourceControls();
// A clearly labeled, repo-native illustration makes exploration possible before
// a visitor grants camera access or chooses a personal photo.
const initialOperation = operation;
const demo = new Image(); demo.src = 'sample.svg';
demo.decode().then(() => {
  if (initialOperation !== operation || mode !== 'empty') return;
  photo.width = demo.naturalWidth; photo.height = demo.naturalHeight; photo.getContext('2d').drawImage(demo, 0, 0);
  mode = 'demo'; frameControls(); sourceControls(); paint();
}).catch(() => { status('Choose a photo or use the live camera to begin.'); });
