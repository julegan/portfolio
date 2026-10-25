# Portfolio workflow

Julie Owens directs and approves this personal portfolio. Submit changes through pull requests; do not commit directly to main or merge on her behalf. Preserve the existing Site identity and audience. New event additions require her review before publication.

## SHOWS snapshot

`julegan/shows` is the canonical development source. This repository deploys its snapshot at `dist/projects/shows/`. Keep app logic, styles, and event data aligned with the corresponding SHOWS PR, while preserving the portfolio's return link to `/projects/`.

Read [SHOWS-EDITORIAL.md](SHOWS-EDITORIAL.md) before expanding the calendar. Underground metal, punk, goth, rock, hardcore, and adjacent DIY scenes are the core priority. The default mixed feed contains music plus select independent art, DIY, zines, and unusual markets. Routine farmers markets and generic city/community listings do not belong in the default feed; retain earlier approved records without prioritizing new unrelated imports. The homepage starts with a chronological list from today; Month and Places are optional. Begin with core music venues and independent promoters, and report source gaps instead of increasing unrelated event counts.

Preserve stable event IDs, source references, evidence-backed music styles, explicit Pacific offsets, unknown fields, and live-show versus DJ distinctions. Label doors-only times accurately, including calendar exports. Keep the current music review in [SHOWS-MUSIC-SOURCES.md](SHOWS-MUSIC-SOURCES.md), and retain earlier review history in [SHOWS-EVENT-SOURCES.md](SHOWS-EVENT-SOURCES.md).

Maintain accessible controls and working date, list, place, search, filter, save, and Google/Apple calendar interactions. Use the canonical repository's meaningful checks and verify the synced static files and portfolio routes before opening the release PR.
