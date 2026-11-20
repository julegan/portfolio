import { DEFAULT_FRAME, portraitCrop, landmarkFrame } from './drapes.mjs';
import { normalizeFrame, transformFrame } from './framing.mjs';

const DEMO_FRAME = { ...DEFAULT_FRAME, y: .5 };

export function createPortrait(video, { onState, onFrame, onStatus, onTracking }) {
  const photo = document.createElement('canvas'), live = document.createElement('canvas');
  const portrait = document.createElement('canvas'); portrait.width = 560; portrait.height = 740;
  let mode = 'empty', frame = normalizeFrame(DEFAULT_FRAME), manual = false;
  let framingRevision = 0, targets = null;
  let operation = 0, stream, animation, tracker, trackerPromise, lastPaint = 0, lastDetection = 0;
  photo.width = photo.height = live.width = live.height = 0;
  const sourceCanvas = () => mode === 'camera' ? live : photo;
  const mirrored = () => mode === 'camera' || mode === 'frozen';
  function render() {
    const source = sourceCanvas();
    const ctx = portrait.getContext('2d'); ctx.clearRect(0, 0, 560, 740);
    if (source.width && source.height) {
      const crop = portraitCrop(source.width, source.height, frame);
      ctx.save();
      if (!frame.rotation) {
        if (mirrored()) { ctx.translate(560, 0); ctx.scale(-1, 1); }
        ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, 560, 740);
      } else {
        ctx.translate(280, 370);
        ctx.rotate(frame.rotation * Math.PI / 180);
        if (mirrored()) ctx.scale(-1, 1);
        ctx.scale(560 / crop.width, 740 / crop.height);
        ctx.drawImage(source, -crop.x - crop.width / 2, -crop.y - crop.height / 2);
      }
      ctx.restore();
    }
    onFrame();
  }
  function notify(reason) { onState({ mode, frame: { ...frame }, ready: mode !== 'empty', canFreeze: mode === 'camera' && live.width > 0 }, reason); }
  function stop() {
    cancelAnimationFrame(animation); stream?.getTracks().forEach(track => track.stop());
    stream = null; video.pause(); video.srcObject = null;
  }
  async function loadTracker() {
    if (tracker) return tracker;
    if (!trackerPromise) {
      onTracking('Loading automatic framing. Manual adjustments are available.');
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
    if (!tracker || manual || mode === 'empty' || mode === 'demo' || !source.width) return;
    const landmarks = tracker.detectForVideo(source, performance.now()).faceLandmarks[0];
    const next = landmarkFrame(landmarks, source.width, source.height);
    if (next) {
      targets = { cheek: landmarks[205], eyes: landmarks[159], jaw: landmarks[199] };
      for (const key of ['x','y','zoom']) frame[key] = smooth ? frame[key] * .65 + next[key] * .35 : next[key];
      frame.rotation = 0;
      notify('framing'); onTracking('Face framing is active. You can also adjust it yourself.');
    } else if (!smooth) onTracking('No single face found. Use the portrait framing controls.');
  }
  async function autoFrame() {
    const token = operation, revision = ++framingRevision;
    if (mode === 'empty') return;
    if (mode === 'demo') { resetFrame(); return; }
    try {
      await loadTracker(); if (token !== operation || revision !== framingRevision) return;
      manual = false; findFrame(sourceCanvas()); render();
    } catch (_) {
      if (token === operation && revision === framingRevision) onTracking('Automatic framing is unavailable here. Use the portrait framing controls.');
    }
  }
  function resetFrame() {
    framingRevision++; manual = true;
    frame = normalizeFrame(mode === 'demo' ? DEMO_FRAME : DEFAULT_FRAME);
    notify('framing'); render(); onTracking('Framing reset.');
  }
  function loop(now) {
    if (mode !== 'camera') return;
    if (video.readyState >= 2 && now - lastPaint > 65 && video.videoWidth) {
      lastPaint = now;
      const w = Math.min(960, video.videoWidth), h = Math.round(w * video.videoHeight / video.videoWidth);
      if (live.width !== w || live.height !== h) { live.width = w; live.height = h; }
      live.getContext('2d').drawImage(video, 0, 0, w, h);
      if (now - lastDetection > 220 && tracker && !manual) {
        lastDetection = now;
        try { findFrame(live, true); } catch (_) { manual = true; onTracking('Tracking paused. Manual framing remains available.'); }
      }
      notify('frame'); render();
    }
    animation = requestAnimationFrame(loop);
  }
  function clear() {
    ++operation; stop(); mode = 'empty'; targets = null; photo.width = photo.height = live.width = live.height = 0;
    portrait.getContext('2d').clearRect(0,0,560,740); notify('clear'); render();
    onStatus('Portrait cleared. Your saved colors contain no photo.');
  }
  function freeze(message = 'Frame frozen. Camera off. Every drape now uses this same portrait.') {
    if (mode !== 'camera') return;
    if (!live.width) { clear(); onStatus('No camera frame was available yet. Try the camera again.'); return; }
    photo.width = live.width; photo.height = live.height; photo.getContext('2d').drawImage(live,0,0);
    stop(); live.width = live.height = 0; mode = 'frozen'; ++operation; notify('freeze'); render(); onStatus(message);
  }
  async function startCamera() {
    const token = ++operation; stop(); live.width = live.height = 0;
    if (!navigator.mediaDevices?.getUserMedia) { onStatus('Camera access needs a supported browser and HTTPS. Choose a photo instead.'); return; }
    onStatus('Waiting for camera permission…'); onState({ mode, frame, ready: mode !== 'empty', waiting: true }, 'waiting');
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      if (token !== operation) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; video.srcObject = acquired;
      acquired.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (mode === 'camera') freeze('Camera ended. Compare the last captured frame.'); }, { once: true }));
      await video.play(); if (token !== operation) { acquired.getTracks().forEach(track => track.stop()); return; }
      photo.width = photo.height = 0; mode = 'camera'; manual = false; targets = null; frame = normalizeFrame(DEFAULT_FRAME);
      notify('source'); onStatus('Settle into even light, then freeze a frame to begin your session.');
      animation = requestAnimationFrame(loop);
      loadTracker().catch(() => { if (token === operation) onTracking('Automatic framing is unavailable here. Use the portrait framing controls.'); });
    } catch (error) {
      if (token !== operation) return;
      stop(); if (mode === 'camera') clear(); else notify('error');
      onStatus(error.name === 'NotAllowedError' ? 'Camera permission was not granted. Choose a photo or allow camera access in browser settings.' : 'The camera could not start. Close other camera apps or choose a photo.');
    }
  }
  async function choosePhoto(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { onStatus('Choose an image smaller than 20 MB.'); return; }
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) { onStatus('Choose a JPEG, PNG or WebP photo. Your browser may also support HEIC.'); return; }
    const token = ++operation; stop(); onStatus('Opening your photo on this device…');
    const url = URL.createObjectURL(file); let image;
    try {
      image = new Image(); image.src = url; await image.decode(); if (token !== operation) return;
      const factor = Math.min(1, 1600 / Math.max(image.naturalWidth,image.naturalHeight));
      photo.width = Math.max(1,Math.round(image.naturalWidth*factor)); photo.height = Math.max(1,Math.round(image.naturalHeight*factor));
      photo.getContext('2d').drawImage(image,0,0,photo.width,photo.height);
      mode = 'photo'; frame = normalizeFrame(DEFAULT_FRAME); manual = false; targets = null; notify('source'); render();
      onStatus('Your photo is ready. It stays on this device for this session.'); autoFrame();
    } catch (_) {
      if (token !== operation) return;
      if (mode === 'camera') clear();
      notify('error'); onStatus('This image could not be opened. Try a JPEG, PNG or WebP photo.');
    } finally { URL.revokeObjectURL(url); if (image) image.src = ''; }
  }
  async function sample() {
    const token = ++operation; stop();
    const image = new Image(); image.src = new URL('studio-portrait-neutral.webp',import.meta.url).href;
    try {
      await image.decode(); if (token !== operation) return;
      photo.width = image.naturalWidth; photo.height = image.naturalHeight; photo.getContext('2d').drawImage(image,0,0);
      mode = 'demo'; frame = normalizeFrame(DEMO_FRAME); manual = true;
      targets = { cheek: { x: .36, y: .54 }, eyes: { x: .39, y: .466 }, jaw: { x: .51, y: .69 } };
      notify('source'); render();
      onStatus('Generated sample portrait for practice.'); onTracking('The sample is already centered.');
    } catch (_) { onStatus('Choose a photo or use the camera to begin.'); }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (mode === 'camera') freeze('Camera stopped while the page was in the background. Your frame is ready.');
      else { ++operation; stop(); notify('cancel'); }
    }
  });
  window.addEventListener('pagehide', () => { clear(); tracker?.close(); tracker = null; trackerPromise = null; });
  return { startCamera, choosePhoto, freeze, clear, sample, autoFrame, resetFrame,
    lockFraming() { manual = true; framingRevision++; },
    move(from, to, ratio, turn) {
      const { width, height } = sourceCanvas();
      if (!width || !height) return;
      frame = transformFrame(frame, { width, height, mirrored: mirrored() }, from, to, ratio, turn);
      if (!manual) onTracking('Manual framing. Choose Auto-frame to find the face again.');
      manual = true; framingRevision++; notify('framing'); render();
    },
    guide(region) {
      const target = targets?.[region];
      if (!target) return null;
      const { width, height } = sourceCanvas();
      const crop = portraitCrop(width, height, frame);
      const x = ((target.x * width - crop.x) / crop.width - .5) * (mirrored() ? -560 : 560);
      const y = ((target.y * height - crop.y) / crop.height - .5) * 740;
      const angle = frame.rotation * Math.PI / 180;
      return { x: .5 + (x * Math.cos(angle) - y * Math.sin(angle)) / 560, y: .5 + (x * Math.sin(angle) + y * Math.cos(angle)) / 740 };
    },
    draw(ctx) { if (mode !== 'empty') ctx.drawImage(portrait,100,31,280,370); },
    copyTo(canvas) { canvas.getContext('2d').drawImage(portrait, 0, 0); },
    get mode() { return mode; }
  };
}
