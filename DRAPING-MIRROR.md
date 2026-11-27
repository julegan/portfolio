# DRAPER

DRAPER is the second version of Draping Mirror, a free personal color studio at `/projects/draping-mirror/`. The route and existing saved colors carry forward. The studio has its own assets, styles, and runtime. Color Lab remains an independent digital color and readability tool.

## Session

1. Begin in full color or set up assistance. The wizard offers descriptions for red–green or blue–yellow differences, larger controls, side-by-side comparisons, and three guidance levels. Assistance is available throughout the session.
2. Choose a photo, freeze a camera frame, or practice with the generated sample. Open **Adjust framing** to drag, pinch, or rotate the portrait. Move, zoom, and rotate buttons offer the same controls without gestures. The focused portrait accepts arrow keys, + / −, and [ / ]. Auto-frame and Reset are separate actions.
3. Compare undertone and intensity, then cross-check the pattern. Review all four whole-palette flags and choose one to refine, or leave the primary season open. The sub-season trials compare temperature, depth, and intensity within the chosen family. Finish by trying whites, dark and middle neutrals, and simulated metals.
4. Use the results to keep selected colors, review observations, and collect ideas for lipstick and makeup. Save A/B comparisons from Tools or the drape browser. The shade ideas are drawn from the palette explored and can be checked in person.

A suggested primary family requires at least two decisive choices and a margin of two on both temperature and intensity. Both-work, undecided, and missing answers leave the direction open. Mixed evidence remains visible. Sub-season refinement needs three decisive comparisons. A balanced choice requires preference for all three anchor drapes. The report distinguishes a season the visitor chooses to explore from the direction supported by their observations. Changing an earlier choice clears the evidence that depends on it. The sample's report is labeled as practice.

## Comparing colors

The original OKLCH collections still have 86 drapes per home or named flow set. Each has 66 colors (22 slots with core, light, and deep shades), 12 neutrals, and eight simulated metals. All 86 appear in the whole-palette flags. Each flag can be selected directly or cycled with the previous and next buttons. The collection controls retain the 16 named flow sets and independent temperature, depth, and intensity adjustments.

In the drape browser, A remains pinned while new selections load into B. **Pin A** promotes B. Neutral rest keeps both pins. **Compare seasons of this color** follows a single authored hue/tone slot through the four home ranges and 16 flows. The starting flow comes first. Previous and next wrap, and **Original** returns to the starting color. The expanded mirror shares the current pair and seasonal position.

The center of the portrait uses the same pixels for A, B, and flags. The selected drape or palette flag fills the whole area outside the portrait, including the top and sides. The same neutral backing protects transparent pixels inside the portrait window. Appearance offers a uniform pale gray, mid gray, or charcoal background as an alternative. The interface theme has its own setting. An optional face-region guide uses the sample's authored coordinates or existing on-device landmarks to position a ring and suggest where to look. A text cue is available if the ring has no valid target. Ring movement respects reduced-motion preferences.

## Observations, measurements, and exports

- **Your observations** include the choices entered during comparisons, the primary season explored, notes, and saved pairs.
- **Measured from the photo** includes up to three selected patches. Contrast Finder reads a 13 × 13 patch around each marker from the framed portrait and averages [linear sRGB relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance), weighted by opacity. The tonal span is the largest reading minus the smallest in percentage points. The grayscale preview, swatch surrounds, and labeled light/medium/high examples are independent of those readings.
- **Palette ideas to try** use prepared swatches from the explored season or sub-season. They are style suggestions. Cameras, displays, lighting, and physical fabrics affect appearance. Visitors can take their findings to a trained personal color professional.

Use **Print / Save PDF** for a text-and-swatches report through the browser's print dialog. The palette PNG is a portrait-free graphic. The separate comparison PNG in Tools includes the same portrait in both views and retains its 1920 × 1320 layout. Analysis JSON contains validated observations, color data, a selected season, practice status, notes, comparisons, saved readings, and an optional explored collection. Older analysis files open with no collection preference. It opens as a portrait-free report. Adding the same portrait allows an unfinished session to resume. The legacy color-only JSON format can also be imported.

## Capture and storage

Camera capture stops on freeze, backgrounding, clear, or page exit. Uploaded images use local blob URLs, are reduced to 1600 pixels on their longest side, and are released after decoding. Photos, landmarks, notes, and measurements stay in session memory. The DRAPER application has no upload API, custom analytics events, service worker, or IndexedDB. The shared portfolio Google Analytics tag measures production page visits, subject to browser privacy signals and earlier refusals. Portraits, landmarks, observations and exported reports are not sent by DRAPER as analytics events. The route permits the documented GA4 non-advertising endpoints; review the GA4 property's Enhanced Measurement settings separately. The same-origin MediaPipe runtime and model in `vendor/` provide optional framing. The route worker responds to GET/HEAD and supplies route-scoped camera permission.

Only deliberately saved colors and selected preferences persist in browser storage. The old `julieowens.draping-mirror.palette.v1` key still stores an array of up to 64 colors. The separate `julieowens.draper.settings.v1` key stores presentation preferences. Existing neutral-surround values are retained for portrait backing, while the new background setting defaults to filling the mirror with drape colors. Analysis files and exported PNGs are created on the device when requested.

## Validation

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
node --test tests/draping*.test.mjs
node tests/draping-browser.cjs
```

The browser suite uses Playwright Chromium and WebKit and axe-core checks across desktop, phone, and short/zoomed viewports. It exercises keyboard and touch input, reduced motion, focus and dialog behavior, color access, crop and portrait-pixel invariants, seasonal flags, same-color cycling, camera track cleanup, report round trips, and network and storage boundaries. Real iPhone camera behavior and screen readers need device verification. Comparison usefulness and seasonal direction need participant and practitioner review before claims about repeatability or accuracy.

## References

- Original consultation interaction references [Matthew's session](https://www.youtube.com/watch?v=jNjLgRpG4_Q) and [Marina's session](https://www.youtube.com/watch?v=IU_Uq3oN5qQ).
- [NIST on digital-camera color error](https://www.nist.gov/publications/color-error-digital-camera-image-capture-process) and [material color and appearance](https://www.nist.gov/publications/chapter-10-color-and-appearance).
- [CSS Color 4 on OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab) and [WCAG 2.2 on alternatives to dragging](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).
- [MediaPipe Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js).
- The DRAPER portrait is a generated sample with a neutral gray backdrop and black clothing. DM Sans and Instrument Serif are self-hosted with their licenses in the project font directory.


## Neutral palettes between seasons

The palette browser and flag comparison include four original collections for exploring a shared characteristic across warm and cool neighbors.

| Collection | Neighboring ranges | Shared characteristic |
| --- | --- | --- |
| Deep Neutral | Deep Autumn and Deep Winter | Depth |
| Light Neutral | Light Spring and Light Summer | Lightness |
| Soft Neutral | Soft Autumn and Soft Summer | Softness |
| Bright Neutral | Bright Spring and Bright Winter | Brightness |

Each collection contains 66 colored drapes, 12 neutrals, and eight simulated metals. Colored and neutral swatches are equal-weight Oklab midpoints of corresponding original seasonal slots. The eight metal previews retain named original swatches spanning silver, gold, copper, champagne, pewter, and bronze. Temperature, depth, and intensity refinements act on the source colors before blending. The colors are original exploration materials with an explicit neighbor description.

The season classifier continues to use recorded comparisons. Choosing a collection records a palette to explore. It appears as **Palette explored** in results, printable reports, and palette PNGs, and in the optional `collection` field of analysis JSON. Neutral collections provide palette ideas without assigning a primary season. Existing original ranges retain their colors and authored slots. Same-color cycling includes the 20 original ranges and the four neutral collections, with the starting swatch pinned as A.

**Choose a palette** groups the home seasons and neutral collections. The range selector appears for home seasons. **Fine-tune this palette** opens the optional three-axis refinements. From a whole-palette flag, **Try these drapes** opens that collection directly. The primary-season checkpoint links to neutral flags for visitors exploring between families.


## Interface color

Both themes use neutral black, grayscale, and bone. This applies to surfaces, buttons, focus and selection indicators, dialogs, guide markers, the project card, and exported report typography and backgrounds. The portrait and actual drape or palette swatches supply color. The generated sample has a gray backdrop and black clothing. The welcome and project card use the same neutral identity.
