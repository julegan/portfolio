# Draping mirror prototype

Route: `/projects/draping-mirror/`, an independent project linked from the portfolio projects page. Review through a portfolio PR; no deployment or merge is part of this change.

## Project boundary

Draping mirror explores personal color through portraits and virtual drapes, with physical clothing and fabric as its context. Color Lab serves digital text-color selection and readability. These are independent sibling projects: no nested routes, cross-project navigation, stylesheet imports, JavaScript imports or shared saved palettes. Draping mirror owns its UI, color-coordinate math, vendor assets, palette key and exports under `dist/projects/draping-mirror/`. Its storage key is `julieowens.draping-mirror.palette.v1`; exported palettes use `draping-mirror-palette` version 1. Standard color science can inform both projects without giving them a shared product workflow.

## Experience

- Live front-camera mirror, local JPEG/PNG/WebP selection (HEIC if the browser can decode it), freeze frame, and explicit portrait clearing.
- Shared portrait crop and unmodified central pixels in both drapes. Frozen comparisons stop camera capture. Backgrounding and leaving the page stop capture too.
- On-demand face framing, with horizontal, vertical and zoom controls as a fallback. The portrait window is an oval crop, not a segmented clothing replacement. Room mapping and WebXR are not used.
- Prepared depth and intensity studies, exploratory red/green/neutral pairs, custom hex colors and OKLCH fine tuning with sRGB fitting.
- Separate measured color relationships, suggested visual experiments and session-only pair preferences. Feature sampling reports recorded pixels and lightness gaps. It does not establish an undertone, personal season, attractiveness, skin health or physical reflectance.
- Saved colors and palette JSON contain only hex colors; comparison PNG is an explicit local download. Seasonal classification is deliberately undecided.

## Privacy and delivery

There is no upload API or server-side photo storage. A selected File is decoded locally through a blob URL, drawn to a bounded canvas, and released. The file input and blob URL are cleared. Portrait canvases are session memory and cleared on explicit removal and page exit. No service worker, IndexedDB, sessionStorage or localStorage portrait persistence is used. The page does not load the portfolio analytics script.

All runtime/model assets are pinned and served from this site, not a third-party CDN. Only a user-selected hex palette is persisted in localStorage. Browser/OS memory management is outside the app; this is not a forensic erasure guarantee.

The portfolio's global `camera=()` header remains intact. The existing Worker serves the new route with a replacement `camera=(self)` Permissions-Policy, other sensitive permissions disabled, a same-origin CSP, and GET/HEAD-only handling. The `ASSETS` binding serves shipped app files. No portrait request body is accepted or logged by the app. Actual Cloudflare response headers should be checked after the review merge.

## Validation

`node --test tests/draping.test.mjs tests/shows-feedback.test.mjs tests/security-headers.test.mjs tests/analytics-consent.test.mjs tests/shows-sync-workflow.test.mjs`

The accessibility workflow also runs `node tests/draping-browser.cjs` with Playwright and axe in Chromium and WebKit at 1440, 390 and 320 CSS pixels. It checks unchanged portrait pixels, local image decoding, same-origin GET-only network activity, model initialization or its manual fallback, palette-only persistence, PNG/JSON exports, and camera lifecycle with a synthetic stream. These are browser-engine checks, not physical iPhone camera verification.

The managed browser preview can lack WebGL; in that case MediaPipe initialization correctly falls back to manual framing. Physical Safari camera behavior and tracking performance need Julie's device review before treating this as a finished AR experience.

## Sources

- [CSS Color 4 / OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab): project-local color-coordinate math, final sRGB values.
- [MediaPipe Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js): position landmarks, not identity recognition.
- [NIST camera color error study](https://www.nist.gov/publications/color-error-digital-camera-image-capture-process): recorded colors depend on capture conditions.
- [CIECAM16 simultaneous contrast research](https://doi.org/10.1002/col.22980): context effects are an exploration prompt, not a validated personal beauty score.

## Next decisions after trying it

Choose a documented seasonal framework, assess how helpful the explanation language is, and decide whether hair/clothing segmentation materially improves the experience. Keep this personal-color experience independent from Color Lab and keep personal images on-device. Detailed mobile usability work follows Julie’s device feedback.
