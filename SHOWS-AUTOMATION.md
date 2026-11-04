# SHOWS portfolio sync: approved data only

SHOWS has two repositories. `julegan/shows` is the canonical source; `julegan/portfolio` holds the deployed website snapshot in `dist/projects/shows/`. Do not deploy unreviewed canonical discovery candidates.

## Connected operating cycle

1. **SHOWS collects daily** (and following discovery-source changes): official venue/booking event records, independent sources, original artwork and coverage-gap reports. The importer validates source IDs, local dates, venue identity and uncertainty labels. Unresolved conflicts remain held; they are not silently published.
2. **One rolling canonical PR:** when `julegan/shows` proposes new event data or images, the workflow creates one source-linked review PR. Later collections update that *same* bot-owned PR with the freshest verified snapshot, rather than blocking or proliferating proposals. The owner still merges that PR into canonical `main`.
3. **Portfolio checks every two hours** at minute 47 UTC (schedule is best effort, not a guaranteed real-time cross-repository webhook), or on manual dispatch. It retrieves the canonical **approved** `events.js` from `main` and validates event IDs, source URLs, Pacific offsets and total count.
4. **One rolling publication PR:** if the approved snapshot differs from the deployed portfolio `main`, the workflow creates or updates one bot-owned sync PR limited to `dist/projects/shows/events.js` and the corresponding cache-version link in `index.html`. An already-current publication PR is left unchanged. When portfolio `main` is current, an obsolete bot sync PR is closed.
5. **Publication:** a human merges the portfolio publication PR. Cloudflare deploys the changed site. The workflow does not auto-merge or push directly to the live branch.

Both repositories require GitHub Actions permission to create PRs. Only generated bot branches and expected data files may be refreshed; the push uses a lease so concurrent updates are not overwritten. PR workflow changes and app design changes still use ordinary development review. The automatic schedule eliminates manual action runs, but there are still two optional human merge points (canonical approval and portfolio release). GitHub scheduling can be delayed, and importer access failures remain visible in action reports.

**Future coverage:** The canonical discovery window is rolling 400 days, not a fixed 2026/December calendar. Shows only appear after the original venue announces them and a human approves the PR. The workflow does not invent dates, images, end times or ticket availability. Source cancellations/reschedules of already approved entries need a separate reconciliation capability.

**Operational order:** merge the automation improvements; the source and sync jobs will run on their schedules. Merge the canonical rolling PR when additions are acceptable; the portfolio sync will prepare its current publication PR within the following polling window. Merge that PR to deploy. An urgent manual run remains available in Actions; no cross-repository secret or unattended merge is required.
