# SHOWS portfolio sync: approved data only

SHOWS has two repositories. `julegan/shows` is the canonical source; `julegan/portfolio` holds the deployed website snapshot in `dist/projects/shows/`. Do not deploy unreviewed canonical discovery candidates.

## Connected operational cycle

1. The canonical `julegan/shows` **daily combined refresh** discovers dated official event listings and collects official event artwork in the same worktree, producing **one canonical review PR** if either changes.
2. After review and merge into canonical `main`, this repository's `.github/workflows/sync-shows.yml` checks **twice daily at 03:47 and 17:47 UTC**, or on manual dispatch, for differences between the **approved** canonical `events.js` and the portfolio snapshot.
3. The sync rejects invalid event data, duplicate IDs, non-HTTPS source URLs and invalid Pacific offsets. If unchanged, it exits without creating a PR.
4. If different and no sync PR is already awaiting review, the workflow prepares a **portfolio review PR** that updates only `dist/projects/shows/events.js` and its cache-busting version in `dist/projects/shows/index.html`. No app design/logic changes are included.
5. **Human approval and merge** are still required to publish. Cloudflare must then deploy the updated portfolio repo. Check the live calendar after merging.

Both repositories need GitHub Actions settings that permit **creation** of PRs. Bots do not approve or merge them. GitHub scheduled workflows are best effort and may be delayed. A still-open canonical PR prevents the next source refresh proposal; a still-open portfolio sync PR prevents another portfolio sync proposal. If a review PR becomes stale, review/close it rather than merging an outdated snapshot.

**Future coverage:** The canonical discovery window is rolling 400 days, not a fixed 2026/December calendar. Shows only appear after the original venue announces them and a human approves the PR. The workflow does not invent dates, images, end times or ticket availability. Source cancellations/reschedules of already approved entries need a separate reconciliation capability.

**Operational order:** merge infrastructure PRs; run the canonical combined workflow and review its generated PR; let the portfolio sync cycle run or use **Actions → Sync approved SHOWS calendar (review-only) → Run workflow**; review its generated PR; verify Cloudflare. No cross-repository secret, direct publishing, or unattended merges are required.
