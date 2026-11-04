import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/shows-feedback.mjs";

const address = "https://julieowens.me/api/shows/feedback";
const enabled = {
  SHOWS_FEEDBACK_GITHUB_TOKEN: "test-token",
  SHOWS_FEEDBACK_TURNSTILE_SECRET: "test-secret"
};
function submission(payload, origin = "https://julieowens.me") {
  return new Request(address, {
    method: "POST",
    headers: { "Origin": origin, "Content-Type": "application/json" },
    body: JSON.stringify({ category: "idea", details: "More underground concerts, please.", link: "", token: "captcha", ...payload })
  });
}
test("feedback endpoint is disabled until both private credentials are present", async () => {
  const res = await worker.fetch(new Request(address + "/config"), {});
  assert.deepEqual(await res.json(), { enabled: false });
  assert.equal((await worker.fetch(submission({}), {})).status, 503);
  assert.deepEqual(await (await worker.fetch(new Request(address + "/config"), { SHOWS_FEEDBACK_TURNSTILE_SECRET: "test-secret" })).json(), { enabled: false });
  assert.deepEqual(await (await worker.fetch(new Request(address + "/config"), { SHOWS_FEEDBACK_GITHUB_TOKEN: "test-token" })).json(), { enabled: false });
  assert.deepEqual(await (await worker.fetch(new Request("https://preview.example/api/shows/feedback/config"), enabled)).json(), { enabled: false });
});
test("server publishes only public sitekey, never credentials", async () => {
  const res = await worker.fetch(new Request(address + "/config"), enabled);
  assert.deepEqual(await res.json(), { enabled: true, sitekey: "0x4AAAAAAFy9aFxzAhvclH7_" });
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});
test("form rejects malformed or cross-origin data without calling third parties", async () => {
  assert.equal((await worker.fetch(submission({}, "https://other.example"), enabled)).status, 403);
  assert.equal((await worker.fetch(submission({ category: "secret" }), enabled)).status, 400);
  assert.equal((await worker.fetch(submission({ details: "short" }), enabled)).status, 400);
  assert.equal((await worker.fetch(submission({ link: "javascript:alert(1)" }), enabled)).status, 400);
});
test("verified submissions become public GitHub issues; invalid challenges are rejected", async () => {
  const prior = globalThis.fetch;
  let calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("siteverify")) return new Response(JSON.stringify({ success: true, hostname: "julieowens.me", action: "shows_feedback" }), { status: 200 });
    return new Response("{}", { status: 201 });
  };
  try {
    const result = await worker.fetch(submission({ category: "correction", link: "https://example.org/event" }), enabled);
    assert.equal(result.status, 201);
    assert.equal((await result.json()).success, true);
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /api.github.com\/repos\/julegan\/shows\/issues/);
    const issue = JSON.parse(calls[1].options.body);
    assert.match(issue.title, /Listing correction/);
    assert.match(issue.body, /example.org\/event/);
    calls = [];
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
    assert.equal((await worker.fetch(submission({}), enabled)).status, 403);
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = prior;
  }
});

test("siteverify rejects wrong action, hostname and reused tokens", async () => {
  const prior = globalThis.fetch;
  let githubIssues = 0;
  let verifiedTokens = new Set();
  let siteResult = { success: true, hostname: "julieowens.me", action: "other_action" };
  globalThis.fetch = async (url, options) => {
    if (url.includes("siteverify")) {
      const data = new URLSearchParams(options.body);
      const token = data.get("response");
      if (verifiedTokens.has(token)) return new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }));
      verifiedTokens.add(token);
      return new Response(JSON.stringify(siteResult));
    }
    githubIssues++;
    return new Response("{}", { status: 201 });
  };
  try {
    assert.equal((await worker.fetch(submission({ token: "bad-action" }), enabled)).status, 403);
    siteResult = { success: true, hostname: "evil.example", action: "shows_feedback" };
    assert.equal((await worker.fetch(submission({ token: "bad-host" }), enabled)).status, 403);
    siteResult = { success: true, hostname: "julieowens.me", action: "shows_feedback" };
    assert.equal((await worker.fetch(submission({ token: "single-use" }), enabled)).status, 201);
    assert.equal((await worker.fetch(submission({ token: "single-use" }), enabled)).status, 403);
    assert.equal(githubIssues, 1);
  } finally {
    globalThis.fetch = prior;
  }
});
