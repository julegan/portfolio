import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const root = join(process.cwd(), "dist");
const pages = [
  "index.html",
  "projects/index.html",
  "projects/shows/index.html",
  "projects/svg-hopper/index.html",
  "projects/tubes/index.html",
  "projects/possible-realities/index.html",
  "projects/chaos/index.html",
  "projects/relationships/index.html",
  "projects/without-coordinates/index.html"
];
const js = readFileSync(join(root, "assets/analytics-consent.js"), "utf8");
const css = readFileSync(join(root, "assets/analytics-consent.css"), "utf8");
test("one shared, first-party consent loader on all nine portfolio pages", () => {
  assert.equal(pages.length, 9);
  for (const page of pages) {
    const html = readFileSync(join(root, page), "utf8");
    assert.equal((html.match(/<script src="\/assets\/analytics-consent\.js" defer><\/script>/g) || []).length, 1, page);
    assert.equal((html.match(/<link rel="stylesheet" href="\/assets\/analytics-consent\.css">/g) || []).length, 1, page);
    assert(!html.includes("https://www.googletagmanager.com/gtag/js"), "No unconditional vendor tag: " + page);
    assert(html.indexOf("analytics-consent.js") < html.indexOf("</head>"), "Consent initialized via head: " + page);
  }
});
test("GA4 measurement and privacy guardrails match the approved opt-in tag", () => {
  assert.match(js, /G-LMS6LWDK63/);
  assert(js.includes("https://www.googletagmanager.com/gtag/js?id="));
  assert.match(js, /analytics_storage: "granted"/);
  assert.match(js, /ad_storage: "denied"/);
  assert.match(js, /ad_user_data: "denied"/);
  assert.match(js, /ad_personalization: "denied"/);
  assert.match(js, /window\.location\.origin \+ window\.location\.pathname/);
  assert.match(js, /PRODUCTION_HOSTS\.has\(window\.location\.hostname\)/);
  assert.match(js, /navigator\.globalPrivacyControl/);
  assert.match(js, /navigator\.doNotTrack/);
  assert.match(js, /saveChoice\("deny"\)/);
  assert.match(js, /clearAnalyticsCookies\(\)/);
  assert.match(css, /\.portfolio-analytics-panel/);
  assert.match(css, /:focus-visible/);
});
test("SHOWS accurately discloses optional tracking without implying saved events are sent", () => {
  const html = readFileSync(join(root, "projects/shows/index.html"), "utf8");
  assert.match(html, /Optional Google Analytics runs only if you allow it/);
  assert.doesNotMatch(html, /no accounts or behavioral tracking/i);
});
