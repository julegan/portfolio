# Tubes v1 — knitting patterns worked in the round

Tubes is a browser-only, no-account knitting pattern playground at
`/projects/tubes/` on the portfolio. It makes real stitch charts and written
round-by-round instructions from one deterministic model.

## Run

Serve the portfolio's `dist/` folder using a local HTTP server:

```sh
python3 -m http.server 8000 --directory dist
```

Visit http://localhost:8000/projects/tubes/. No bundler, backend, API key,
account, font download, or third-party script is required.

## V1 features

- Change circumference, height, yarn category, and gauge independently.
- Repeated motifs around the circumference or a continuous wraparound
  design; repeat vertically or generate one design up the tube.
- Diamonds, chevrons, waves, speckles, and a stylized landscape.
- 1–6 colors in four palettes, four complexity levels, optional purl texture.
- Deterministic generation with repeatable random seed; Generate another,
  Undo, and Redo.
- Actual right-to-left stitch chart (round 1 at bottom), clickable color editing, and
  precise labeled round/stitch editor for keyboard users.
- Schematic cylinder drawn from *the same stitch cells* as the chart.
  It shows the front half of the tube; it is not a photo or fabric simulation.
- Local browser saves and downloadable **editable .tubes.json** projects.
  Reimport restores all parameters and stitch edits without an account.
- Export actual SVG, PNG, Markdown instructions, or browser
  **Print / Save as PDF**, including 40-stitch × 30-round chart sheets.

## Crucial sizing behavior

When a motif repeats around the tube, cast-on stitches =
motif width × number of repeats. The *actual* circumference therefore
changes if repeats change, even when the target size is unchanged. The
displayed estimate comes from cast-on count and measured stitch gauge;
yarn category is only a starting suggestion.

A one-wrap design instead calculates an even cast-on count from the target
circumference and gauge. The generated model is capped at 240 stitches and
200 rounds in v1 to keep the browser chart usable.

## Limitations and knitting safety

- Generated patterns are not test-knit or fitted. Knitters need to swatch,
  verify gauge, yardage, colors, tension, floats, and finishing.
- Only stitch-count-preserving knit/purl colorwork is supported. No
  increases, decreases, ribbing-specific fit, lace, cables, short rows,
  shaping, or machine-ready instructions.
- Floats are estimated from same-color gaps on circular rounds; the number
  is a warning, not automatic float management.
- The cylinder is a stylized projection of chart data, not a physically
  accurate fabric simulation. PNG/SVG files are graphics; PDF is
  print-oriented and cannot be reimported as editable projects.
- Markdown includes written instructions; export a chart graphic separately
  as its companion. Print uses the platform print UI; automatic PDF file
  downloading is not provided.
- Browser saves may disappear when browser data is cleared. Download
  `.tubes.json` files to back up or move editable designs between devices.
- No user-supplied image-to-chart conversion, yarn library, yarn quantities,
  ZIP bundle, sharing links, or custom palette editing in v1.

## Checks

```sh
node tests/tubes.test.mjs
```

The Tubes workflow also runs browser controls/export smoke checks on
desktop and mobile via Playwright. Visual and hands-on knitting review
remain necessary before treating generated instructions as dependable.

## Product direction

Next steps: swatch-informed sizing, custom palette editing, motif lock/remix,
one-click bundle, image-to-chart conversion, better realistic fabric
visualization, and more sophisticated construction only when stitch
instructions can be validated.
