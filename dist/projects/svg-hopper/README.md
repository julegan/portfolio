# SVG Hopper 0.1 — browser-only prototype

A small, independent demonstration of configurable, language-ready SVG graphics. This is not a City of Portland service or official brand implementation.

## Try it

Serve the portfolio's `dist` directory with any static HTTP server and open `/projects/svg-hopper/`:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/projects/svg-hopper/.

No build, account, AI model, API key, backend, or dependency install required. Files and image data stay local to the browser; nothing is transmitted to a server by the app.

## Demonstrates

- Two composition modes: **100% vector** shape background, or an **uploaded raster photo** with true SVG overlay/text.
- Three **demonstration-only** style presets; four aspect ratios and a photo *cover/contain* control.
- English and Spanish **user-supplied** copy and optional descriptions. Languages are switched by rendering the same composition with different real `<text>`/`<tspan>` nodes; no automatic translation.
- High-contrast, opaque text panels, explicit SVG `<title>`, optional `<desc>`, and download as actual standalone SVG.
- Dynamic text wrapping and font-size adjustment, with an error rather than exporting text that cannot be laid out.

## Review checklist

1. Change English copy and confirm the preview and downloaded SVG contain text nodes, not text turned into paths or pixels.
2. Switch to Spanish, then blank the Spanish headline and confirm generation/download blocks. Enter the translation again.
3. Select **Your photo + SVG text**, upload a valid local JPEG/PNG/WebP, and compare **fill frame** versus **show full photo**.
4. Try each aspect ratio with short and long text. Long copy must fit inside the solid text panel or show an explicit validation message.
5. Verify keyboard-only controls, visible focus, the status message, and layouts at small viewport sizes and browser zoom.
6. Open the saved SVG in an independent viewer; try using it in a simple HTML page with a context-appropriate `<img alt="...">`.

## Known limitations

- This proof of concept does **not** translate text, integrate with Drupal, apply an organization's approved design tokens, or certify WCAG compliance.
- SVG text is editable and language-ready, **not automatically translated** when an SVG is displayed by a CMS as a conventional image (`<img>`). Drupal would need a deliberate translation/rendering strategy.
- The image description is encoded in `<desc>` for inline SVG. An image published as `<img>` still requires an appropriate HTML `alt` attribute.
- Uploaded photos stay raster even though they are embedded inside the SVG. Fully vector output is available only in **Vector shapes** mode.
- SVG aspect ratios are presets, not a freely editable canvas; photo cropping uses center alignment. The composer does not analyze the photo content.
- SVG fonts refer to common system fonts. Different installed fonts/renderers may render text differently; production systems would need controlled font assets and fuller text-layout testing.
- User-supplied SVGs, untrusted remote assets, and custom logo imports are deliberately unsupported. Uploaded photos are restricted to a small set of bitmap types with an 8 MB limit. A production server should still implement its own SVG sanitization, CSP, size constraints, and publishing checks.

## Product direction

The near-term question: can a non-designer create a readable, reusable graphic in a visual style, then adapt its words to another language without rebuilding an image? Future work can add shared styles/design tokens, reviewed translation workflows, accessible export guidance, flexible illustration, Drupal integration, and user feedback.
