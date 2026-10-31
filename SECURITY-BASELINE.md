# Security baseline and rollout

The site publishes static assets via the Cloudflare Workers `assets.directory = "./dist"` setting. The public GitHub repository is a source and collaboration system, not an administrative interface for visitors.

## Protections proposed in this change

- Global Cloudflare static-asset response headers in `dist/_headers`: MIME sniffing disabled, same-origin framing only, privacy-conscious referrer policy, and unnecessary sensitive browser APIs disabled.
- A no-dependency security test in `tests/security-headers.test.mjs` that checks the headers and that all external GitHub Actions are pinned to full commit IDs.
- Explicit read-only `GITHUB_TOKEN` permissions in validation workflows; the SHOWS-sync workflow retains narrowly scoped write permissions to create review PRs.
- Verified `actions/checkout` v4.2.2 and `actions/setup-node` v4.4.0 commit pins; Dependabot checks for updated GitHub Actions weekly.

Run the local check with `node --test tests/security-headers.test.mjs`. After merging, inspect the *deployed* response headers on the homepage and an interactive project route (for example `curl -I https://julieowens.me/` and `curl -I https://julieowens.me/projects/shows/`). The repository test cannot prove Cloudflare delivered the headers.

## Account and infrastructure checks (manual; not verifiable from source)

1. GitHub, Cloudflare, and domain registrar: require phishing-resistant MFA; review passkeys, recovery, app access and unused tokens.
2. Both GitHub repos: inspect branch protection/rulesets and require PR review and passing validation before merging to `main`; prevent direct pushes and force pushes if available. The GitHub app cannot read current branch-protection settings.
3. GitHub: enable available secret scanning, Dependabot alerts and automatic security updates; review proposed dependency changes rather than enabling unattended production merges.
4. Cloudflare: verify SSL/TLS mode and HTTPS redirects, review WAF/security analytics and deployment access.
5. Domain registrar: verify domain lock, auto-renewal, recovery and DNSSEC compatibility.

## Intentionally deferred

- **CSP**: inline scripts exist on the main site; adopt report-only validation before an enforcing policy, with tests for SHOWS, Tubes, SVG Hopper, and experimental projects.
- **Strict-Transport-Security**: wait until apex and `www` HTTPS, redirect behavior and long-term support are confirmed; do not enable preload without an explicit decision.
- **Data as code**: SHOWS currently ships `events.js`. Migrate untrusted event content toward validated JSON and safer rendering in a separate, reviewed change.
- **Node test dependencies**: existing browser-test workflows install npm packages without a lockfile. Add a manifest/lockfile and `npm ci` in a follow-up rather than making unverified test-runtime changes here.
- **SHOWS repo Actions**: apply the same pinning, token-scope and security-test standard in the separate canonical `julegan/shows` repository.

These headers cover Cloudflare-managed **static asset responses**, not future responses generated directly by Worker code. Apply equivalent headers in Worker request handlers when new dynamic endpoints are introduced.
