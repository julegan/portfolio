// Account-free SHOWS feedback receiver. Runs only for /api/shows/feedback*.
const categories = {
  idea: "Idea",
  correction: "Listing correction",
  "missing-event": "Missing event",
  bug: "Bug report"
};
// Existing Cloudflare Turnstile widget; public sitekey, never the private secret.
const TURNSTILE_SITEKEY = "0x4AAAAAAFy9aFxzAhvclH7_";
const TURNSTILE_ACTION = "shows_feedback";
const PRODUCTION_HOSTNAMES = new Set(["julieowens.me", "www.julieowens.me"]);
const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}
function configured(env) {
  return Boolean(env.SHOWS_FEEDBACK_GITHUB_TOKEN &&
    env.SHOWS_FEEDBACK_TURNSTILE_SECRET);
}
function quote(value) {
  // GitHub issues are public. Avoid accidental mention notifications.
  return value.replace(/@/g, "＠").split("\n").map(line => "> " + line).join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/shows/feedback/config" && request.method === "GET") {
      const enabled = configured(env) && PRODUCTION_HOSTNAMES.has(url.hostname);
      return json({ enabled, ...(enabled ? { sitekey: TURNSTILE_SITEKEY } : {}) });
    }
    if (url.pathname !== "/api/shows/feedback") return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!configured(env) || !PRODUCTION_HOSTNAMES.has(url.hostname)) return json({ error: "Feedback is not available yet" }, 503);
    if (request.headers.get("Origin") !== url.origin) return json({ error: "Origin not allowed" }, 403);
    if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json"))
      return json({ error: "Expected JSON" }, 415);
    if (Number(request.headers.get("Content-Length") || 0) > 8000)
      return json({ error: "Message too large" }, 413);

    let submission;
    try {
      const content = await request.text();
      if (content.length > 8000) return json({ error: "Message too large" }, 413);
      submission = JSON.parse(content);
    } catch (_) {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!submission || typeof submission !== "object") return json({ error: "Invalid submission" }, 400);
    const category = submission.category;
    const details = typeof submission.details === "string" ? submission.details.trim() : "";
    const link = typeof submission.link === "string" ? submission.link.trim() : "";
    const token = typeof submission.token === "string" ? submission.token : "";
    if (!Object.hasOwn(categories, category) || details.length < 10 || details.length > 2000 ||
        token.length < 1 || token.length > 2048 || link.length > 500)
      return json({ error: "Invalid fields" }, 400);
    if (link) {
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Invalid URL");
      } catch (_) {
        return json({ error: "Related link must be an HTTPS URL" }, 400);
      }
    }
    let verified = false;
    try {
      const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({
          secret: env.SHOWS_FEEDBACK_TURNSTILE_SECRET,
          response: token
        })
      });
      if (verification.ok) {
        const data = await verification.json();
        verified = data.success === true && data.action === TURNSTILE_ACTION &&
          data.hostname === url.hostname && PRODUCTION_HOSTNAMES.has(data.hostname);
      }
    } catch (_) {}
    if (!verified) return json({ error: "Verification failed. Please retry." }, 403);

    const title = "[SHOWS feedback] " + categories[category] + ": " +
      details.split(/\n/)[0].replace(/\s+/g, " ").replace(/@/g, "＠").slice(0, 80);
    const body = [
      "**Type:** " + categories[category],
      "",
      "## Feedback",
      quote(details),
      ...(link ? ["", "**Related link:** " + link] : []),
      "",
      "_Submitted through the SHOWS feedback form. This issue is public; it is not an approved calendar change._"
    ].join("\n");
    try {
      const result = await fetch("https://api.github.com/repos/julegan/shows/issues", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.SHOWS_FEEDBACK_GITHUB_TOKEN,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "shows-feedback-worker",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title, body })
      });
      if (result.status !== 201) return json({ error: "Could not submit feedback" }, 502);
      return json({ success: true }, 201);
    } catch (_) {
      return json({ error: "Could not submit feedback" }, 502);
    }
  }
};
