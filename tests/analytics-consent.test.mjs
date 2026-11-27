import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";
const root = join(process.cwd(), "dist");
function publicHtml(dir, prefix = "") {
  return readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) return entry.name === "vendor" ? [] : publicHtml(join(dir, entry.name), relative + "/");
    return entry.isFile() && entry.name.endsWith(".html") ? [relative] : [];
  });
}
const pages = publicHtml(root);
const js = readFileSync(join(root, "assets/analytics-consent.js"), "utf8");
const css = readFileSync(join(root, "assets/analytics-consent.css"), "utf8");
test("one shared first-party loader on every public HTML page", () => {
  for (const page of ["index.html", "projects/index.html", "projects/shows/index.html", "projects/color-lab/index.html", "projects/draping-mirror/index.html"]) assert(pages.includes(page), page);
  assert(pages.length >= 11);
  for (const page of pages) {
    const html = readFileSync(join(root, page), "utf8");
    assert.equal((html.match(/<script src="\/assets\/analytics-consent\.js" defer><\/script>/g) || []).length, 1, page);
    assert.equal((html.match(/<link rel="stylesheet" href="\/assets\/analytics-consent\.css">/g) || []).length, 1, page);
    assert(!html.includes("https://www.googletagmanager.com/gtag/js"), "No duplicate vendor tag: " + page);
  }
});
test("GA4 starts by default with privacy safeguards and no interactive consent", () => {
  assert.match(js, /G-LMS6LWDK63/);
  assert.match(js, /analytics_storage: "granted"/);
  assert.match(js, /ad_storage: "denied"/);
  assert.match(js, /ad_user_data: "denied"/);
  assert.match(js, /ad_personalization: "denied"/);
  assert.match(js, /allow_google_signals: false/);
  assert.match(js, /allow_ad_personalization_signals: false/);
  assert.match(js, /window\.location\.origin \+ window\.location\.pathname/);
  assert.match(js, /referrer\.origin \+ referrer\.pathname/);
  assert.match(js, /PRODUCTION_HOSTS\.has\(window\.location\.hostname\)/);
  assert.match(js, /navigator\.globalPrivacyControl/);
  assert.match(js, /navigator\.doNotTrack/);
  assert.match(js, /localStorage\.getItem\(CONSENT_KEY\) === "deny"/);
  assert.match(js, /if \(!isProduction \|\| browserOptOut \|\| previouslyDeclined\) return;/);
  assert.doesNotMatch(js, /localStorage\.setItem|Analytics preferences|portfolio-analytics-choices|createElement\("button"\)/);
  assert.doesNotMatch(css, /portfolio-analytics-panel|position:\s*fixed/);
  assert.match(js, /tools\.google\.com\/dlpage\/gaoptout/);
});
test("SHOWS accurately discloses tracking and local saved events", () => {
  const html = readFileSync(join(root, "projects/shows/index.html"), "utf8");
  assert.match(html, /Google Analytics measures visits by default/);
  assert.match(html, /saved events stay in this browser/);
  assert.doesNotMatch(html, /Optional Google Analytics runs only if you allow it/);
});
