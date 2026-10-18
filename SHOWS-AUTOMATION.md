# Portfolio automatic SHOWS sync

This repository is the **public SHOWS snapshot**, not the source of truth. The canonical SHOWS events are edited and approved through **julegan/shows**. This workflow proposes data-only synchronization after canonical approval.

Workflow: `.github/workflows/sync-shows.yml`.

1. Scheduled daily at 17:47 UTC, or run manually under Actions, **after** the infrastructure PR merges.
2. Fetch the **approved `julegan/shows` main** branch's `events.js` via the fixed public raw.githubusercontent.com URL. No cross-repository secret is needed because the canonical repository is public.
3. Refuse malformed JSON/JS, duplicate event IDs, missing HTTPS source links or invalid Pacific-offset timestamps.
4. Compare against `dist/projects/shows/events.js`. If identical, do nothing.
5. If different, create a **portfolio pull request** containing only the event-data update. Never push to `main` or bypass Julie's review. Leave pending automated PRs alone to prevent review churn.
6. After approval/merge, **verify the hosting platform deploys the updated `dist/` directory**. This workflow prepares repository changes; it does not operate the external website's publishing controls. Check for a failed/disabled scheduled workflow or hosting deployment rather than assuming the public site is live.

## Setup

Both repositories require GitHub **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. Our workflows only create PRs; they do not automatically approve or merge them. YAML workflow permissions request `contents:write` and `pull-requests:write`. If permissions are denied, inspect the failed workflow run and repository/org configuration.

The initial implementation also syncs a one-time change to `dist/projects/shows/app.js`, enabling clear **Listed time** labels and **time unverified** calendar exports for proposed records if an editor merges an automatic discovery PR without refining that field first.

No publication is scheduled until **both** PRs are merged and the platform's existing deployment behavior is confirmed. The canonical JSON adapter has passed a live source probe in GitHub Actions: 71 official No Fun calendar items were read, 15 new candidates survived conservative source conflict holds, and the complete calendar tests passed on the generated 197-event proposal. The **scheduled bot PR creation and portfolio sync** still require post-merge first-run verification. No status, ticket inventory, cancellation monitoring or scraper guarantees are implied.

See canonical SHOWS [discovery/README.md](https://github.com/julegan/shows/blob/main/discovery/README.md) after that PR is merged for source priorities and limitations.
