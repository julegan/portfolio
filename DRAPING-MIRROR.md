# Draping mirror: guided personal color session

Route: `/projects/draping-mirror/`, an independent project linked from the portfolio projects page. Changes are reviewed through a portfolio PR; Julie merges and publishes.

## Product boundary and brief

This experience guides a personal color consultation: prepare a portrait, explore undertone, establish a working home season, refine its flow, cross-check the observations, and explore finishing colors. It is independent from the digital accessibility picker. No nested routes, cross-project navigation, runtime imports, stylesheet imports or shared palettes connect the two projects.

The interface retains the portfolio's soft black, neutral typography and controls. **Drapes are study materials, not brand colors.** Their hues, lightness, intensity and simulated finishes are independently chosen for each comparison. They must not be muted, recolored or constrained to the website theme.

The opening comparisons deliberately exaggerate differences. Later comparisons are closer. “Help” provides face-focused guidance; subtler comparisons can temporarily switch to a stronger practice pair, whose observations never count toward the result. The visitor can record A, B, both, or uncertainty. Both drapes must have been shown before recording a comparison. A neutral rest and optional side-by-side view are available.

## Original collection and interpretation

`session.mjs` defines our original study collection in OKLCH, using project-local color-coordinate functions and chroma reduction to fit sRGB. No commercial drape kit, measured swatch collection, palette assets or proprietary instructions are copied. Names, coordinates, groupings, prompts and heuristics are authored here. Color values remain behind the interface; visitors use prepared named drapes rather than color inputs or hex codes.

The four home directions use conventional seasonal vocabulary: warm/bright (Spring), cool/soft (Summer), warm/soft (Autumn), cool/bright (Winter). Three closer comparisons explore temperature, depth and intensity within the tentative home family. Possible refinement labels are True (balanced), Warm/Cool, Light/Deep, and Bright/Soft as appropriate to the home family, giving 16 possible working labels. These labels are an exploratory framework, **not a validated diagnostic instrument or an automatic assessment of a face**.

The result follows the visitor's recorded observations. Each of temperature and intensity needs at least two decisive observations and a margin of at least two to narrow a home season. Ties, skipped comparisons and both-work responses do not count as evidence for either direction. Mixed evidence is disclosed. A flow needs decisive responses to all three refinement comparisons; competing variants remain unresolved. True requires affirmative preference for the anchor in all three comparisons, rather than being assigned for uncertainty. If confirmation changes the home family, prior flow evidence is not reused for the new home.

Changing an earlier response clears all subsequent branch-dependent observations. A new portrait resets the session. A practice result for the illustrated sample is explicitly identified as practice and cannot describe the visitor. Season suggestions include an explanation of the recorded pattern, a revisitable comparison history and a direct invitation to cross-check the direction across more colors.

The finishing stage includes whites, dark and middle neutrals, polished silver/gold previews, and satin rose-copper/champagne previews. These support wardrobe exploration and do not score the season. Metal gradients simulate appearance only; they do not reproduce physical reflections onto skin. Final exploration colors are distinct from the pronounced diagnostic comparisons.

Each home season has a full-range collection and four named flow starting sets. Each now contains **86 prepared drapes: 66 colors (22 hue families, each in core/light/deep versions), 12 neutrals and eight simulated metals**. Named sets can be refined toward warmer/cooler, lighter/deeper and softer/brighter in combination. For example, a visitor can choose Deep Winter and explore a softer version without having to switch to a different season. These three discrete refinements support 27 combinations per starting set; they are prepared exploration choices, not hex/color inputs or a claim of 27 new professionally defined seasons. Neutrals and metals follow the same refinements. Browsing and custom refinements do not change recorded assessment evidence or manufacture a more precise classification. The guided classifier still offers its provisional home/16-season starting direction.

Every chip applies to the unchanged portrait. The first selected drape becomes reference A; subsequent choices load into B while A stays fixed, including when the visitor changes season, flow, hue family or finish. A/B buttons switch the displayed drape. “Pin A” explicitly promotes the current B into A, retaining the old A in B. Neutral rest preserves both pins. A new portrait or restarted session clears the in-memory comparison. Exploration and pinning never change assessment observations.

## Phone experience

The default comparison surface contains only the portrait and drape. Captions, A/B controls, the enlarge button, family browsing, neutral rest, saving and feedback all sit outside its bounds. Each canvas is redrawn to its actual frame dimensions, including rotation and dialog expansion. Fabric extends to both side edges and the bottom, removing internal letterboxing. The portrait keeps its original 360:476 proportions and fits completely inside the frame; it is neither stretched nor enlarged by clipping. `object-fit: contain` remains a safeguard, with the bitmap matching the frame's aspect ratio. The PNG comparison export retains its fixed 1920×1320 layout. On short/zoomed screens the page reflows into a scrollable layout.

Guided comparisons show their purpose (temperature, intensity, depth, or finishing color), with A/B drapes directly below the image. The observation sheet opens only when requested. Seasonal exploration has pinned A/B cards, a reserved comparison/status line, and a compact hue-family selector beside Rest and Save. The reserved line prevents save feedback from resizing the portrait. Color browsing opens on Reds & corals, with direct choices for pinks/berries, purples, blues, teals/aquas, greens, yellows/golds, all colors, neutrals and metallics. Each color belongs to exactly one browsing family. The horizontal phone rail and desktop grid both retain all 86 drapes per starting set.

The comparison note describes differences in the actual displayed colors: hue, depth, intensity and simulated finish. It can identify similar dimensions for a mostly single-dimension comparison. Thresholds are descriptive UI aids, not biological analysis or a claim that a drape suits a face. Guided observation language and the human test plan remain the basis for evaluating usefulness.

The enlarged mirror also keeps its controls outside the image and shows the whole portrait/cloth. In exploration it swaps the pinned pair; in guided mode it swaps the prepared pair. Visible button controls remain available alongside swiping. Native sheets retain focus restoration and Escape support; pinch zoom is not blocked. Pinned choices and collection refinements stay in memory. Up to 64 explicitly saved hex colors remain compatible with the existing color-only storage format.

## Privacy and capture

Camera and local JPEG/PNG/WebP selection (HEIC when browser-supported) are retained. Camera capture must freeze before a guided comparison can begin. Freezing, backgrounding, clearing and leaving stop capture. Portraits and observations remain in memory; clearing, reloading and leaving discard them. No portrait, face landmarks or session responses are persisted. Source images are bounded to 1600 pixels on their longest dimension, decoded from local blob URLs and released. The file input is cleared.

A shared source crop supplies unmodified central pixels in every drape. Transparent image regions get identical neutral backing, including where the oval overlaps the drape. The portrait window remains an oval crop, not clothing segmentation. Automatic face-position framing is optional and uses the pinned same-origin MediaPipe runtime/model in `vendor/`; manual position and zoom remain available.

Only explicitly saved hex colors persist under `julieowens.draping-mirror.palette.v1`. Palette JSON contains format, version and hex colors only. PNG comparison downloads intentionally include the portrait. There are no analytics, third-party runtime requests, upload API, service worker, IndexedDB or portrait browser-storage records. Browser/OS memory management is not a forensic erasure guarantee.

The Worker preserves the site-wide camera deny baseline and replaces it only for `/projects/draping-mirror` and descendants, with a same-origin CSP and GET/HEAD-only handling. Actual Cloudflare camera/CSP headers require deployed verification after Julie merges.

## Validation

`node --test tests/draping.test.mjs tests/shows-feedback.test.mjs tests/security-headers.test.mjs tests/analytics-consent.test.mjs tests/shows-sync-workflow.test.mjs`

The browser workflow runs `node tests/draping-browser.cjs` in Chromium and WebKit at 1440 × 900, 390 × 744 and 320 × 568 CSS pixels, plus a 256 × 440 reflow view representing short/zoomed conditions. It covers the full guided sequence, revising earlier observations, non-scoring practice drapes, unresolved outcomes, identical portrait pixels, transparent local images, PNG/JSON exports, palette-only persistence, camera lifecycle, blocked storage, denied camera access and automated accessibility checks. Phone checks assert that the portrait, prompt, drape controls, responses and Continue remain in the viewport through every comparison, and that chip labels/rows do not overlap. Explorer checks cover home/flow selection, all collection types, swapping the previous drape, local saves, unchanged portrait pixels, independently scrolling chips and unchanged classification. Real iPhone camera performance and human perception of these exploratory drapes need further device/practitioner review.

## Research informing the interaction

- [Colour Analysis Studio, Matthew's session](https://www.youtube.com/watch?v=jNjLgRpG4_Q), 2024-11-29. Available transcript: undertone comparisons from 0:50; broad intensity at 8:40; subgroup comparisons at 11:47; balanced/True discussion at 20:23; neighboring-group cross-checks at 21:14. The analyst reverses drape order and guides observations of the face. This informs interaction research, not scientific validation or a copied drape inventory.
- [Colour Analysis Studio, Marina's session](https://www.youtube.com/watch?v=IU_Uq3oN5qQ), 2025-01-04. Published chapters include undertone (0:56), intensity (7:50), subgroups (10:24), and borderline checks (21:03). Chapter/description research, not a claim of a complete watched session.
- [NIST: Color Error in the Digital Camera Image Capture Process](https://www.nist.gov/publications/color-error-digital-camera-image-capture-process). Capture errors vary with camera and illumination; virtual previews do not recreate real fabric's illumination effects.
- [NIST: Color and Appearance](https://www.nist.gov/publications/chapter-10-color-and-appearance). Material appearance includes illumination/viewing conditions, gloss and other effects beyond a flat color.
- [CSS Color 4 / OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab). Color-coordinate math describes the shipped colors, not a person's season.
- [MediaPipe Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js). Framing uses position landmarks, not identity recognition or color classification.

## Success criterion and next human review

The product succeeds if people can use it to arrive at a useful, repeatable understanding of their season. Automated tests verify behavior and privacy, not that outcome. More drapes alone do not validate the heuristic.

Run a small formative phone study before claiming accuracy:

1. Ask participants to start with their own portrait and complete the process unaided. Observe whether they can find the first action, swap drapes, express uncertainty, use Help, and reach a working direction without zooming or losing the portrait.
2. Ask them to explain their temperature, home and flow in their own words, using several colors and neutrals as evidence. Record where they cannot perceive a difference rather than treating every completed session as a success.
3. For participants with an independent in-person analysis, keep that label out of the app until after completion. Compare home-season agreement and flow agreement separately, including unresolved results and mismatches; do not count a forced answer as success.
4. Repeat with a second portrait in controlled neutral lighting, then compare selected drapes with actual fabric. Check whether the working direction is stable and where capture/display effects change it.
5. Review the prompts and color pairs with a practitioner across varied complexions. Revise weak comparisons from observed failures before tuning scores to fit expected labels.

Keep study portraits on participants’ devices. There is no new telemetry, portrait submission or participant-data collection feature in this iteration. Real iPhone camera/viewport behavior, perceived color differences and the classification model still need that human review.

## Merge integration, November 8, 2026

Resolved the pending branch's three conflicts with main by retaining both SHOWS event-preview routing and draping's route-scoped camera policy, both Worker-first route lists, and both trusted-sync and draping security checks. The merged security workflow uses a proper multiline command block. Running the combined suite exposed an existing trusted-snapshot parser failure: prefix validation used the first assignment marker rather than the marker actually matched by the JSON parser. It now uses `match.index`, so an executable earlier assignment is rejected by the existing regression test. No SHOWS event data or publishing policy is changed by that fix.

## Unobstructed comparison review

Browser regression checks require the mirror to use containment and assert that controls/status labels do not intersect its rectangle. They verify stable mirror bounds before/after saving, A remaining pinned through collection changes, explicit repinning, neutral rest, hue-family navigation and continued uncertainty/privacy behavior. These checks address the reported jawline/fabric obstruction directly; they do not establish seasonal classification accuracy.

## Portrait-first setup

The mirror precedes camera/photo controls in the DOM. Desktop shows them beside each other; mobile puts the preview above the capture choices. A bounded preview stays visible while the visitor scrolls through framing controls. Capture status sits beside the preview outside the image; pending camera access, live video and frozen/photo states are explicit. Freeze is first in the camera toolbar when live capture is active. Compact setup chrome keeps the preview and initial camera/photo choices together. Scroll padding/margins keep keyboard-focused framing controls below the sticky preview. Guided comparison and seasonal exploration layouts are unaffected.

Browser regression checks assert mobile setup order, visible initial capture choices, preview visibility during framing, non-overlap with a focused framing slider, and live-camera feedback/capture cleanup.
