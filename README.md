# Julie Owens — Digital product portfolio

A personal portfolio about making public services easier to find, understand, and use—and understanding the systems that make them work.

I’m the City of Portland’s lead enterprise digital product manager, with a background in design and development. My work crosses departments, services, and shared platforms: shaping product vision and roadmaps, directing architecture and design, establishing standards and practices, and coordinating delivery.

This portfolio starts with the work and the people it serves. Connection is a design principle: following an everyday need through the information, people, policy, and technology involved in meeting it.

## The work

The portfolio brings together three dimensions of my practice:

- **Products and services:** public and employee websites, permitting experiences, public alerts, and other digital products.
- **Shared practices:** accessibility, content governance, standards, service design methods, and coordination across teams.
- **Connected systems:** the relationships between policy, organizations, information, and technology—and what happens when they change.

The current site introduces Portland.gov, PortlandMaps, public process tools, everyday services, and Civic Systems Atlas. Future case studies will develop the stories of Portland’s government transition, the permitting website experience, digital accessibility remediation, and the collaborative Digital Services Playbook.

Project stories will identify my role, collaborators, and documented outcomes. This is a personal portfolio, not an official City of Portland website.

## Personal project gallery

- `/projects/` is the independent ideas/prototypes directory, separate from professional case studies on the home page.
- `/projects/shows/` embeds a self-contained snapshot of the [SHOWS](https://github.com/julegan/shows) event calendar prototype.
- Each project card has a thumbnail, date/status, tags, concise description and direct launch link.
- To add another project, create `dist/projects/<slug>/`, add a thumbnail SVG/image, and replicate a project card in `dist/projects/index.html`. No account, CMS, build system, or external service is necessary for this early gallery.
- SHOWS's source repository remains the canonical development repository. The portfolio copy is a deployment snapshot; future SHOWS updates must be synced intentionally. The October–December 2026 snapshot contains 182 dated occurrences, including 128 music dates after the latest 27-date independent venue pass. It is manually maintained. [SHOWS-EDITORIAL.md](SHOWS-EDITORIAL.md) preserves the original underground music priority; [SHOWS-MUSIC-SOURCES.md](SHOWS-MUSIC-SOURCES.md) records the new bills, genre evidence, source gaps, and review process. [SHOWS-EVENT-SOURCES.md](SHOWS-EVENT-SOURCES.md) retains the earlier source review.
- The gallery can grow gradually; the idea of one experiment per month is an aspiration rather than a promised release schedule.

## Site status

**V1 is the accepted baseline. The hosted site remains private while content and project stories are refined.**

The domain is [julieowens.me](https://julieowens.me); access currently requires authorization. This GitHub repository is public. Publishing the website is a separate decision.

The site uses a single-page layout and a soft black, white, and cool gray palette. Visitors can explore work through four everyday needs or read the page from beginning to end. Current artwork is conceptual and labeled accordingly.

## Preview locally

Open [dist/index.html](dist/index.html) in a browser for the home page. It contains the original standalone portfolio page, including inline CSS, SVG illustrations, and JavaScript.

For working navigation to `/projects/` and `/projects/shows/`, use the local HTTP server below rather than opening files directly, because the routes are root-relative.

No installation or build step is required. There are no external fonts, analytics, or runtime dependencies.

Alternatively, from the repository root, serve the site locally:

```sh
python3 -m http.server 8000 --directory dist
```

Then open <http://localhost:8000>.

## Repository guide

| File | Purpose |
| --- | --- |
| [dist/index.html](dist/index.html) | Professional portfolio home page |
| [dist/projects/index.html](dist/projects/index.html) | Personal projects index at `/projects/` |
| [dist/projects/shows/index.html](dist/projects/shows/index.html) | SHOWS working prototype at `/projects/shows/` |
| [DESIGN-NOTES.md](DESIGN-NOTES.md) | Design decisions and review notes for the accepted version |
| [SOURCES.md](SOURCES.md) | Source references and factual scope for the accepted version |

## Making changes

Use a separate branch and pull request for changes. Julie reviews and merges them; do not commit directly to `main`. Website publication and changes to its audience require Julie’s explicit instruction.

Before submitting a site change, check the relevant content and links, JavaScript syntax, responsive layout, and keyboard interactions. The site includes a readable baseline without JavaScript, visible focus, native dialogs and disclosures, and reduced-motion support.

Browser, assistive-technology, and zoom/reflow review remain part of preparation for launch. These design choices and automated checks do not establish accessibility conformance.

## Connect

[LinkedIn](https://www.linkedin.com/in/julieh/)


The October 17, 2026 SHOWS venue-coverage proposal adds 36 source-linked music dates (182 total occurrences, 128 music). See [SHOWS-VENUE-COVERAGE.md](SHOWS-VENUE-COVERAGE.md) for confirmed venue listings and documented source gaps. The SHOWS source of truth remains `julegan/shows`; this folder is a manually deployed snapshot requiring Julie's review.


SHOWS independent-venue + thumbnail release: [SHOWS-INDEPENDENT-VENUES.md](SHOWS-INDEPENDENT-VENUES.md) documents 27 additional Portland music dates, source conflicts and gaps in data ingestion. [SHOWS-ARTWORK.md](SHOWS-ARTWORK.md) explains non-representational event thumbnails and the review requirements for real flyer artwork. Published snapshot remains manually updated and requires approval.


### Proposed SHOWS automation

[SHOWS-AUTOMATION.md](SHOWS-AUTOMATION.md) explains the proposed daily source-of-truth sync from the approved `julegan/shows` main branch to a **portfolio review PR**, with publishing remaining separate. The matching canonical source discovery pilot is reviewed in [SHOWS PR #6](https://github.com/julegan/shows/pull/6). Neither workflow publishes unreviewed events.
