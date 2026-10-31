# Julie Owens — personal portfolio and experimental projects

Source for [julieowens.me](https://julieowens.me): a personal creative and professional space. This is **not** an official City of Portland website or a copy of a résumé.

Julie is a designer and Principal Product Manager, Enterprise Digital Platforms, at the City of Portland. Over two decades, her work has developed alongside many City websites and teams. The professional sections describe recurring areas of collaborative practice—not isolated claims of sole authorship, complete case studies, or a verified impact ledger.

The site is intentionally in progress. Its visual direction is art-directed, typographic, primarily soft black and cool neutrals, with room for unusual interactions and reversible experiments.

## Pages and prototypes

| Path | Purpose |
| --- | --- |
| `/` | Home: design, civic digital work, values, systems, and the person behind the work |
| `/projects/` | Two collections: useful creative tools and the Possible Realities laboratory |

| `/projects/shows/` | SHOWS, a reviewed Portland music and independent culture calendar snapshot |
| `/projects/svg-hopper/` | SVG Hopper, a language-ready graphic composer prototype |
| `/projects/tubes/` | Tubes, a local-first pattern generator for knitting in the round |
| `/projects/possible-realities/` | Possible Realities laboratory, including its rule workbench and notebook |
| `/projects/chaos/` | Almost the Same: chaos and divergent trajectories |
| `/projects/relationships/` | Only Between: relationships and emergent structure |
| `/projects/without-coordinates/` | Without Coordinates: graph distance without predefined space |

The last three experiments are linked as independent investigations within Possible Realities. Their existing URLs are preserved.

The retired SHOWS A/B comparison pages (`/projects/shows/preview-a/` and `/projects/shows/preview-b/`) are intentionally **not** deployed. The production SHOWS calendar uses `/projects/shows/` and still depends on `preview.css` despite that stylesheet's historical name. Do not restore the discarded demo pages or delete active production styles during future snapshot updates.

## Build and hosting

This is a static site: HTML, CSS, SVG and browser JavaScript in `dist/`, with no bundler or mandatory account. Cloudflare serves `./dist` using `wrangler.jsonc`.

Local preview:

```sh
python3 -m http.server 8000 --directory dist
```

Visit <http://localhost:8000>. A local HTTP server is important because internal routes are root-relative and some prototypes use JavaScript modules.

## SHOWS: source of truth and updates

[`julegan/shows`](https://github.com/julegan/shows) is the canonical development repository. This portfolio contains the approved deployment snapshot under `dist/projects/shows/`.

The [review-only sync workflow](.github/workflows/sync-shows.yml) checks the canonical `main` branch twice daily and proposes a **portfolio pull request** only when approved event data has changed. It does **not** merge, publish, or change application CSS/logic automatically. A human reviews and merges the portfolio PR before the hosted copy changes. Do not assume a historical event count or a fixed October–December window represents the current collection.

Operational material: [SHOWS-AUTOMATION.md](SHOWS-AUTOMATION.md), [SHOWS-EDITORIAL.md](SHOWS-EDITORIAL.md), and the evidence/review files named `SHOWS-*.md`. Historical research notes may contain older snapshots; retain their dated context.

## Quality and review

- [`.github/workflows/accessibility.yml`](.github/workflows/accessibility.yml) runs browser and automated WCAG 2.1 AA checks for portfolio and SHOWS routes, including responsive behavior. These checks do **not** certify WCAG conformance.
- [`.github/workflows/tubes.yml`](.github/workflows/tubes.yml) exercises the Tubes model, browser interactions, and export paths.
- Tests are in `tests/`; prototype-specific notes are inside their respective directories.
- Real device, keyboard, screen reader, zoom/reflow and link checks should accompany significant interface releases.
- Source-provided visual and editorial claims must be attributed. Do not represent personal conceptual graphics as official City products.

## Collaboration

All changes go to a new branch and PR. Julie reviews and merges; never commit directly to `main` or auto-merge. Favor small, reversible design iterations. Keep old public routes working, protect SHOWS data provenance, and avoid invented professional results or individual-credit claims. See [AGENTS.md](AGENTS.md) and [DESIGN-NOTES.md](DESIGN-NOTES.md).

Contact: [LinkedIn](https://www.linkedin.com/in/julieh/).

## Design lineage: PortlandMaps

The homepage includes Julie’s personal account of designing the **first mobile-first PortlandMaps.com interface** more than a decade ago. This was one contribution within a collaborative City effort. The City’s June 2026 modernization was delivered by subsequent teams and must not be attributed to the earlier designer. The accompanying visual is abstract, not a screenshot. Public release context: [PortlandMaps modernization (June 2026)](https://www.portland.gov/bts/cgis/news/2026/6/4/new-and-improved-portlandmaps-coming-soon).
