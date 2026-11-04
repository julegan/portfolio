# SHOWS in-app feedback — existing Turnstile widget

SHOWS offers account-free feedback for listing corrections, missing shows, bugs and ideas. Visitor submissions become **public GitHub Issues** in `julegan/shows`, not automatically published events.

## Integration status

- **Existing widget reused** — public sitekey `0x4AAAAAAFy9aFxzAhvclH7_`. Do **not** create another widget.
- Frontend: `dist/projects/shows/feedback.js` (canonical source: `julegan/shows/feedback.js`). It loads Turnstile only when visitors open the form and renders with action `shows_feedback` and the public sitekey returned by the Worker.
- Backend: `src/shows-feedback.mjs` in the existing Cloudflare Worker `julieowens-portfolio`, using `wrangler.jsonc` at repository root and production environment. Siteverify requires `success === true`, action `shows_feedback`, and the exact production hostname (`julieowens.me` or `www.julieowens.me`) before calling GitHub.
- The public sitekey is compiled into the Worker: **do not set a `SHOWS_FEEDBACK_TURNSTILE_SITEKEY` secret**. The form stays hidden unless both private Worker secrets below are installed.

## Remaining one-time Cloudflare/GitHub setup

Never paste private keys or tokens into GitHub code, PR comments, or chat.

1. In the Cloudflare dashboard, select the **already-created Turnstile widget** for the sitekey above. Confirm the allowed production hostname(s) include `julieowens.me` (and `www.julieowens.me` if the alias is used). **Preserve the widget's existing mode and clearance level.** Use its existing **secret key**, not the public sitekey, for server verification.
2. In Cloudflare Workers & Pages, open the existing **`julieowens-portfolio`** Worker → Settings → Variables and Secrets. Add this *secret* binding: `SHOWS_FEEDBACK_TURNSTILE_SECRET` (the secret corresponding to the existing widget). Do not change Worker name or deploy a second Worker.
3. Create a **fine-grained GitHub personal access token** restricted to the **`julegan/shows`** repository with **Issues: Read and write** permission only. Add it as Worker *secret* `SHOWS_FEEDBACK_GITHUB_TOKEN`. If a suitable token and binding are already present, reuse them. Ensure GitHub Issues are enabled in the SHOWS repository.
4. Save the bindings and deploy the latest merged portfolio commit if Cloudflare requires a new deployment. Check `https://julieowens.me/api/shows/feedback/config`. It should return `{"enabled":true,"sitekey":"0x4AAAAAAFy9aFxzAhvclH7_"}`, without disclosing the Turnstile secret or GitHub token.
5. Open `https://julieowens.me/projects/shows/` and submit a **real** test feedback report. Confirm one new issue appears in `julegan/shows`, then retry the **same token** (via browser debugging or a controlled request) to verify replay is rejected. Close the test issue afterward.

If either secret is missing, the config endpoint returns `{"enabled":false}`, POSTs fail closed, and **Send feedback** remains hidden. The public sitekey alone cannot enable real submissions.

## Existing-widget automated recovery (advanced)

Cloudflare's [Turnstile Spin existing-widget guide](https://developers.cloudflare.com/turnstile/spin/prompt.md) supports guarded credential retrieval using an authenticated, approved **Wrangler ≥4.109** binary (outside the project directory). Do not retrieve the widget secret unless you have confirmed the Cloudflare account, exact sitekey, expected domains, Worker name, `wrangler.jsonc` target, environment and destination binding `SHOWS_FEEDBACK_TURNSTILE_SECRET`, and inspected `wrangler secret list`. Require explicit approval for the exact mapping before any credential-bearing read/write. Never expose the secret in command arguments, disk logs, temporary files, or chat. The normal Cloudflare dashboard secret-binding steps above are also appropriate.

## Privacy and editorial safeguards

- The form does not request accounts, names, email addresses or uploads. It warns contributors that their report is publicly visible on GitHub, so they should omit personal information. Standard Cloudflare/GitHub service processing still applies.
- Cloudflare Turnstile loads only after visitors open the form; the server checks Siteverify (including action and hostname), same-origin POST, field length and URL scheme. Turnstile reduces spam but is not a substitute for monitoring or rate limits.
- Reports about changed dates, cancellations or missing shows are **unverified leads** until checked against original sources and manually approved.
- Do not log client IPs or private form values; do not expose backend tokens to JavaScript.

## Verification

Offline tests: `node --test tests/shows-feedback.test.mjs`. CI also checks code, accessibility and deployment. Passing CI does **not** confirm the live secret bindings or a successful real Turnstile token; complete the live checks above.
