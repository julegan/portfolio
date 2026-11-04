import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/shows-feedback.mjs";

const address = "https://julieowens.me/api/shows/feedback";
const enabled = {
  SHOWS_FEEDBACK_GITHUB_TOKEN: "test-token",
  SHOWS_FEEDBACK_TURNSTILE_SECRET: "test-secret",
  SHOWS_FEEDBACK_TURNSTILE_SITEKEY: "test-key"
};
function submission(payload, origin = "https://julieowens.me") {
  return new Request(address, {
    method: "POST",
    headers: { "Origin": origin, "Content-Type": "application/json" },
    body: JSON.stringify({ category: "idea", details: "More underground concerts, please.", link: "", token: "captcha", ...payload })
  });
}
test("feedback endpoint is disabled until all credentials are present", async () => {
  const res = await worker.fetch(new Request(address + "/config"), {});
  assert.deepEqual(await res.json(), { enabled: false });
  assert.equal((await worker.fetch(submission({}), {})).status, 503);
});
test("server publishes only public sitekey, never credentials", async () => {
  const res = await worker.fetch(new Request(address + "/config"), enabled);
  assert.deepEqual(await res.json(), { enabled: true, sitekey: "test-key" });
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
    if (url.includes("siteverify")) return new Response(JSON.stringify({ success: true, hostname: "julieowens.me" }), { status: 200 });
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
