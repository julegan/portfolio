# Draping mirror: guided personal color session

Route: `/projects/draping-mirror/`, an independent project linked from the portfolio projects page. Changes are reviewed through a portfolio PR; Julie merges and publishes.

## Product boundary and brief

This experience guides a personal color consultation: prepare a portrait, explore undertone, establish a working home season, refine its flow, cross-check the observations, and explore finishing colors. It is independent from the digital accessibility picker. No nested routes, cross-project navigation, runtime imports, stylesheet imports or shared palettes connect the two projects.

The interface retains the portfolio's soft black, neutral typography and controls. **Drapes are study materials, not brand colors.** Their hues, lightness, intensity and simulated finishes are independently chosen for each comparison. They must not be muted, recolored or constrained to the website theme.

The opening comparisons deliberately exaggerate differences. Later comparisons are closer. “Help me see the difference” provides face-focused guidance; subtler comparisons can temporarily switch to a stronger practice pair, whose observations never count toward the result. The visitor can record A, B, both, or uncertainty. Both drapes must have been shown before recording a comparison. A neutral rest and optional side-by-side view are available.

## Original collection and interpretation

`session.mjs` defines our original study collection in OKLCH, using project-local color-coordinate functions and chroma reduction to fit sRGB. No commercial drape kit, measured swatch collection, palette assets or proprietary instructions are copied. Names, coordinates, groupings, prompts and heuristics are authored here. Color values remain behind the interface; visitors use prepared named drapes rather than color inputs or hex codes.

The four home directions use conventional seasonal vocabulary: warm/bright (Spring), cool/soft (Summer), warm/soft (Autumn), cool/bright (Winter). Three closer comparisons explore temperature, depth and intensity within the tentative home family. Possible refinement labels are True (balanced), Warm/Cool, Light/Deep, and Bright/Soft as appropriate to the home family, giving 16 possible working labels. These labels are an exploratory framework, **not a validated diagnostic instrument or an automatic assessment of a face**.

The result follows the visitor's recorded observations. Each of temperature and intensity needs at least two decisive observations and a margin of at least two to narrow a home season. Ties, skipped comparisons and both-work responses do not count as evidence for either direction. Mixed evidence is disclosed. A flow needs decisive responses to all three refinement comparisons; competing variants remain unresolved. True requires affirmative preference for the anchor in all three comparisons, rather than being assigned for uncertainty. If confirmation changes the home family, prior flow evidence is not reused for the new home.

Changing an earlier response clears all subsequent branch-dependent observations. A new portrait resets the session. A practice result for the illustrated sample is explicitly identified as practice and cannot describe the visitor. Season suggestions include an explanation of the recorded pattern, a revisitable comparison history and original wardrobe exploration colors.

The finishing stage includes whites, dark and middle neutrals, polished silver/gold previews, and satin rose-copper/champagne previews. These support wardrobe exploration and do not score the season. Metal gradients simulate appearance only; they do not reproduce physical reflections onto skin. Final exploration colors are distinct from the pronounced diagnostic comparisons.

## Phone experience

A single large portrait with A/B swapping is the default. At phone widths, the observation prompt appears before the mirror, followed by the response controls. Camera/photo setup is collapsible once a session begins. The setup instructions, detailed framing, learning guidance, saved collection and methodology disclose on demand. No floating overlay covers the portrait. The user can go back, revisit a result comparison, restart, or clear their portrait.

## Privacy and capture

Camera and local JPEG/PNG/WebP selection (HEIC when browser-supported) are retained. Camera capture must freeze before a guided comparison can begin. Freezing, backgrounding, clearing and leaving stop capture. Portraits and observations remain in memory; clearing, reloading and leaving discard them. No portrait, face landmarks or session responses are persisted. Source images are bounded to 1600 pixels on their longest dimension, decoded from local blob URLs and released. The file input is cleared.

A shared source crop supplies unmodified central pixels in every drape. Transparent image regions get identical neutral backing, including where the oval overlaps the drape. The portrait window remains an oval crop, not clothing segmentation. Automatic face-position framing is optional and uses the pinned same-origin MediaPipe runtime/model in `vendor/`; manual position and zoom remain available.

Only explicitly saved hex colors persist under `julieowens.draping-mirror.palette.v1`. Palette JSON contains format, version and hex colors only. PNG comparison downloads intentionally include the portrait. There are no analytics, third-party runtime requests, upload API, service worker, IndexedDB or portrait browser-storage records. Browser/OS memory management is not a forensic erasure guarantee.

The Worker preserves the site-wide camera deny baseline and replaces it only for `/projects/draping-mirror` and descendants, with a same-origin CSP and GET/HEAD-only handling. Actual Cloudflare camera/CSP headers require deployed verification after Julie merges.

## Validation

`node --test tests/draping.test.mjs tests/shows-feedback.test.mjs tests/security-headers.test.mjs tests/analytics-consent.test.mjs tests/shows-sync-workflow.test.mjs`

The browser workflow runs `node tests/draping-browser.cjs` in Chromium and WebKit at 1440, 390 and 320 CSS pixels. It covers the full guided sequence, revising earlier observations, non-scoring practice drapes, unresolved outcomes, identical portrait pixels, transparent local images, PNG/JSON exports, palette-only persistence, camera lifecycle, blocked storage, denied camera access and automated accessibility checks. Real iPhone camera performance and human perception of these exploratory drapes need further device/practitioner review.

## Research informing the interaction

- [Colour Analysis Studio, Matthew's session](https://www.youtube.com/watch?v=jNjLgRpG4_Q), 2024-11-29. Available transcript: undertone comparisons from 0:50; broad intensity at 8:40; subgroup comparisons at 11:47; balanced/True discussion at 20:23; neighboring-group cross-checks at 21:14. The analyst reverses drape order and guides observations of the face. This informs interaction research, not scientific validation or a copied drape inventory.
- [Colour Analysis Studio, Marina's session](https://www.youtube.com/watch?v=IU_Uq3oN5qQ), 2025-01-04. Published chapters include undertone (0:56), intensity (7:50), subgroups (10:24), and borderline checks (21:03). Chapter/description research, not a claim of a complete watched session.
- [NIST: Color Error in the Digital Camera Image Capture Process](https://www.nist.gov/publications/color-error-digital-camera-image-capture-process). Capture errors vary with camera and illumination; virtual previews do not recreate real fabric's illumination effects.
- [NIST: Color and Appearance](https://www.nist.gov/publications/chapter-10-color-and-appearance). Material appearance includes illumination/viewing conditions, gloss and other effects beyond a flat color.
- [CSS Color 4 / OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab). Color-coordinate math describes the shipped colors, not a person's season.
- [MediaPipe Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js). Framing uses position landmarks, not identity recognition or color classification.

## Next review

Review the phone flow and compare real portraits in several lighting conditions. Assess whether the strong-to-subtle progression and observation language are useful across varied complexions, whether the original drapes sufficiently distinguish their intended dimension, and how a practitioner would revise the sequence and evidence heuristic. Add segmentation only if it materially improves the draping experience. Keep personal images on-device and the project independent.
