import { DEFAULT_FRAME, portraitCrop, landmarkFrame } from './drapes.mjs';

export function createPortrait(video, { onState, onFrame, onStatus, onTracking }) {
  const photo = document.createElement('canvas'), live = document.createElement('canvas');
  const portrait = document.createElement('canvas'); portrait.width = 560; portrait.height = 740;
  let mode = 'empty', frame = { ...DEFAULT_FRAME }, manual = false;
  let operation = 0, stream, animation, tracker, trackerPromise, lastPaint = 0, lastDetection = 0;
  photo.width = photo.height = live.width = live.height = 0;
  function render() {
    const source = mode === 'camera' ? live : photo;
    const ctx = portrait.getContext('2d'); ctx.clearRect(0, 0, 560, 740);
    if (source.width && source.height) {
      const crop = portraitCrop(source.width, source.height, frame);
      ctx.save();
      if (mode === 'camera' || mode === 'frozen') { ctx.translate(560, 0); ctx.scale(-1, 1); }
      ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, 560, 740); ctx.restore();
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
    const detection = tracker.detectForVideo(source, performance.now());
    const next = landmarkFrame(detection.faceLandmarks[0], source.width, source.height);
    if (next) {
      for (const key of ['x','y','zoom']) frame[key] = smooth ? frame[key] * .65 + next[key] * .35 : next[key];
      notify('framing'); onTracking('Face framing is active. You can also adjust it yourself.');
    } else onTracking('No single face found. Use the portrait framing controls.');
  }
  async function autoFrame() {
    const token = operation; manual = false; frame = { ...DEFAULT_FRAME }; notify('framing'); render();
    if (mode === 'empty' || mode === 'demo') return;
    try {
      await loadTracker(); if (token !== operation || mode === 'empty') return;
      findFrame(mode === 'camera' ? live : photo); render();
    } catch (_) { onTracking('Automatic framing is unavailable here. Use the portrait framing controls.'); }
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
    ++operation; stop(); mode = 'empty'; photo.width = photo.height = live.width = live.height = 0;
    portrait.getContext('2d').clearRect(0,0,560,740); notify('clear'); render();
    onStatus('Portrait cleared. Your saved colors contain no photo.');
  }
  function freeze(message = 'Frame frozen. Camera off. Every drape now uses this same portrait.') {
    if (mode !== 'camera') return;
    if (!live.width) { clear(); onStatus('No camera frame was available yet. Try the camera again.'); return; }
    photo.width = live.width; photo.height = live.height; photo.getContext('2d').drawImage(live,0,0);
    stop(); mode = 'frozen'; ++operation; notify('freeze'); render(); onStatus(message);
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
      photo.width = photo.height = 0; mode = 'camera'; manual = false; frame = { ...DEFAULT_FRAME };
      notify('source'); onStatus('Settle into even light, then freeze a frame to begin your session.');
      animation = requestAnimationFrame(loop);
      loadTracker().catch(() => onTracking('Automatic framing is unavailable here. Use the portrait framing controls.'));
    } catch (error) {
      if (token !== operation) return;
      stop(); notify('error');
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
      mode = 'photo'; frame = { ...DEFAULT_FRAME }; manual = false; notify('source'); render();
      onStatus('Your photo is ready. It stays on this device for this session.'); autoFrame();
    } catch (_) {
      if (token !== operation) return;
      if (mode === 'camera') clear();
      notify('error'); onStatus('This image could not be opened. Try a JPEG, PNG or WebP photo.');
    } finally { URL.revokeObjectURL(url); if (image) image.src = ''; }
  }
  async function sample() {
    const token = ++operation; stop();
    const image = new Image(); image.src = new URL('sample.svg',import.meta.url).href;
    try {
      await image.decode(); if (token !== operation) return;
      photo.width = image.naturalWidth; photo.height = image.naturalHeight; photo.getContext('2d').drawImage(image,0,0);
      mode = 'demo'; frame = { ...DEFAULT_FRAME }; manual = true; notify('source'); render();
      onStatus('Illustration for learning the process. A practice result cannot describe your coloring.');
      onTracking('The illustration uses manual framing.');
    } catch (_) { onStatus('Choose a photo or use the camera to begin.'); }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (mode === 'camera') freeze('Camera stopped while the page was in the background. Your frame is ready.');
      else { ++operation; stop(); notify('cancel'); }
    }
  });
  window.addEventListener('pagehide', () => { clear(); tracker?.close(); tracker = null; trackerPromise = null; });
  return { startCamera, choosePhoto, freeze, clear, sample, autoFrame,
    setFrame(next) { frame = next; manual = true; onTracking('Manual framing. Use “Find face” to reset.'); notify('framing'); render(); },
    draw(ctx) { if (mode !== 'empty') ctx.drawImage(portrait,100,31,280,370); },
    get mode() { return mode; }
  };
}
