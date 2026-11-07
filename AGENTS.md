# Portfolio workflow

Julie Owens directs and approves this independent, personal creative and professional portfolio. Submit changes through pull requests; do not commit directly to main or merge on her behalf. The site is intentionally exploratory, not an official City website or a résumé replacement. Favor small, reversible, accessible experiments. Do not invent career metrics, claim sole credit for collaborative work, or describe an evolving platform as personally authored in all its versions. New SHOWS event additions require her review before publication, except that a repository-approved trusted-original auto-publishing policy may publish append-only verified events through scoped scheduled bots. Code changes, new source trust assignments and all exceptional events still require a user-reviewed PR. Never merge a PR on the user's behalf.

## SHOWS snapshot

`julegan/shows` is the canonical development source. This repository deploys its snapshot at `dist/projects/shows/`. Keep app logic, styles, and event data aligned with the corresponding SHOWS PR, while preserving the portfolio's return link to `/projects/`.

Read [SHOWS-EDITORIAL.md](SHOWS-EDITORIAL.md) before expanding the calendar. Underground metal, punk, goth, rock, hardcore, and adjacent DIY scenes are the core priority. The default mixed feed contains music plus select independent art, DIY, zines, and unusual markets. Routine farmers markets and generic city/community listings do not belong in the default feed; retain earlier approved records without prioritizing new unrelated imports. The homepage starts with a chronological list from today; Month and Places are optional. Begin with core music venues and independent promoters, and report source gaps instead of increasing unrelated event counts.

Preserve stable event IDs, source references, evidence-backed music styles, explicit Pacific offsets, unknown fields, and live-show versus DJ distinctions. Label doors-only times accurately, including calendar exports. Keep the current music review in [SHOWS-MUSIC-SOURCES.md](SHOWS-MUSIC-SOURCES.md), and retain earlier review history in [SHOWS-EVENT-SOURCES.md](SHOWS-EVENT-SOURCES.md).

Maintain accessible controls and working date, list, place, search, filter, save, and Google/Apple calendar interactions. Use the canonical repository's meaningful checks and verify the synced static files and portfolio routes before opening the release PR.

## Trusted SHOWS snapshot synchronization

Once the owner approves the trusted-original source-policy PRs, the scheduled Portfolio sync may automatically publish a snapshot only when its delta consists **exclusively** of newly appended SHOWS events carrying the approved trust proof. All existing portfolio records must match the approved canonical source exactly; no edits, removals, venue changes, rights-pending images, unknown-source records or interface changes qualify. A non-force guarded bot push may fail under branch protections, in which case the existing portfolio review PR remains the fallback. Never bypass protected branch rules by rewriting commits or merging unrelated PRs.
