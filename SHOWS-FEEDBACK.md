# SHOWS in-app feedback — activation

SHOWS accepts feedback in the calendar without a visitor account. The frontend is deliberately hidden until the receiver is configured; publishing the two PRs alone does **not** enable submission.

## One-time owner setup (do not paste credentials into GitHub, chat, or source)

1. In GitHub, confirm Issues are enabled for `julegan/shows`. Create a **fine-grained personal access token** restricted to the single SHOWS repository with only **Issues: Read and write** permission.
2. In the Cloudflare dashboard, create a **Turnstile** widget for `julieowens.me` (and `www.julieowens.me` if used), then copy its **sitekey** and **secret**.
3. In Cloudflare Workers & Pages → `julieowens-portfolio` → Settings → Variables and Secrets, set these three **secret** values:
   - `SHOWS_FEEDBACK_GITHUB_TOKEN` — the fine-grained GitHub token.
   - `SHOWS_FEEDBACK_TURNSTILE_SECRET` — the Turnstile secret.
   - `SHOWS_FEEDBACK_TURNSTILE_SITEKEY` — the Turnstile sitekey (public to browsers, but configured as a Worker secret for convenience).
4. Publish a deployment with the new Worker code and secrets. Visit `https://julieowens.me/api/shows/feedback/config`. Expect `{"enabled":true,"sitekey":"…"}` — **no** GitHub or Turnstile secret should appear.
5. Open `/projects/shows/`, verify **Send feedback** appears and submit a test report. Confirm that a new public Issue appears in `julegan/shows`. Close the test Issue.

Until step 4, the form is hidden and the endpoint fails closed. If someone reports that feedback is unavailable, first check the Worker deploy, Turnstile hostname, secret bindings, and GitHub Issues token permission.

## Editorial, abuse and privacy boundaries

- Categories: idea, incorrect/change listing, missing event, bug. Listing-specific **Report listing issue** prefills an event link. No account, names, contact details, or file uploads.
- Every report becomes a **public GitHub Issue**, not a calendar publication. The form explicitly tells visitors not to include personal information. Do not post private replies or sensitive information into the issue tracker.
- Cloudflare Turnstile is loaded only after a visitor opens the form. Tokens are verified server-side with exact hostname matching. Validation, size limits, HTTPS-only optional links and same-origin checks reduce abuse. They do not replace monitoring or operational limits; watch the public issue queue and rate-limit at Cloudflare if abused.
- A report of cancellation or a new show is a **lead**, never an automatic event change. Apply SHOWS editorial standards and independently verify organizer sources before merging changes.
- Do not record visitor IPs, email addresses or other personal profile data in the Worker or the GitHub issue. Standard Cloudflare/GitHub service processing still applies.

## Local checks

```sh
node --test tests/shows-feedback.test.mjs
```

A plain `python3 -m http.server` preview serves static UI only and will not expose the submission button. End-to-end testing needs the deployed Cloudflare Worker and valid credentials.
