import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/shows-feedback.mjs";
import {parsePublishedSnapshot, eventMetadata, addEventMetadata} from "../src/shows-share.mjs";

const event1 = {
  id: "concert-100", title: 'Band <A> & "B"', subtitle: "With guests",
  startsAt: "2026-11-14T19:00:00-08:00", startTimeKind: "doors",
  venue: "High Limit Room", neighborhood: "Portland",
  artwork: {url: "https://source.example/flyer.jpg",sourceUrl:"https://source.example/event",origin:"official-event-page"}
};
const event2 = {
  id: "event-200", title: "Night Market", startsAt: "2026-11-20T12:00:00-08:00",
  startTimeKind: "date-only", venue: "Somewhere", neighborhood: "SE Portland"
};
const page = '<!doctype html><html><head><meta name="description" content="Generic SHOWS"><title>SHOWS — Portland music and independent culture</title></head><body>Calendar</body></html>';
let published = [event1, event2];
function snapshot() {
  return 'window.SHOWS_DATASET = ' + JSON.stringify({totalOccurrences: published.length}) +
    ';\nwindow.SHOWS_EVENTS = ' + JSON.stringify(published) + ';\n';
}
const env = {
  ASSETS: {fetch: async request => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/projects/shows/") return new Response(page, {headers: {"Content-Type":"text/html"}});
    if (pathname === "/projects/shows/events.js")
      return new Response(snapshot(), {headers: {"Content-Type":"application/javascript"}});
    return new Response("Not found", {status:404});
  }}
};
const target = "https://julieowens.me/projects/shows/";

test("strictly parse approved JSON assignment without code execution", () => {
  assert.deepEqual(parsePublishedSnapshot(snapshot()), published);
  assert.throws(() => parsePublishedSnapshot('alert(1);\n' + snapshot()), /executable/i);
  assert.throws(() => parsePublishedSnapshot(snapshot().replace('"totalOccurrences":2', '"totalOccurrences":3')), /Incomplete/);
});

test("distinct social preview metadata comes from reviewed events, escaped in raw HTML", async () => {
  const a = await worker.fetch(new Request(target + "?event=concert-100"), env);
  const b = await worker.fetch(new Request(target + "?event=event-200"), env);
  const first = await a.text(), second = await b.text();
  assert.equal(a.status, 200);
  assert.equal(a.headers.get("cache-control"), "no-store");
  assert.match(first, /og:title" content="Band &lt;A&gt; &amp; &quot;B&quot; — SHOWS/);
  assert.match(first, /Doors 7:00 PM · High Limit Room/);
  assert.match(first, /og:url" content="https:\/\/julieowens.me\/projects\/shows\/\?event=concert-100"/);
  assert.match(first, /og:image" content="https:\/\/julieowens.me\/projects\/shows\/share-card.svg"/);
  assert.match(first, /twitter:description/);
  assert.match(second, /Night Market — SHOWS/);
  assert.match(second, /Time TBA/);
  assert.doesNotMatch(second, /Doors 7:00 PM/);
  assert.match(first, /<title>Band &lt;A&gt;/);
});

test("unknown and malformed event IDs fall back to the public calendar", async () => {
  for (const suffix of ["?event=missing", "?event=" + "x".repeat(500)]) {
    const result = await worker.fetch(new Request(target + suffix), env);
    assert.equal(await result.text(), page);
  }
});

test("an updated approved publication changes preview without editing a separate index", async () => {
  const before = await (await worker.fetch(new Request(target + "?event=event-200"), env)).text();
  published = [event1, {...event2, title:"Updated original title"}];
  const after = await (await worker.fetch(new Request(target + "?event=event-200"), env)).text();
  assert.match(before, /Night Market — SHOWS/);
  assert.match(after, /Updated original title — SHOWS/);
});

test("artwork is only shareable with explicit social permission", () => {
  assert.equal(eventMetadata(event1).image, "https://julieowens.me/projects/shows/share-card.svg");
  assert.equal(eventMetadata({...event1,artwork:{...event1.artwork,usageApproved:true,socialSharingApproved:true}}).image,
    "https://source.example/flyer.jpg");
  assert.equal(eventMetadata({...event1,artwork:{...event1.artwork,url:"javascript:evil",usageApproved:true,socialSharingApproved:true}}).image,
    "https://julieowens.me/projects/shows/share-card.svg");
});

test("hostile event fields cannot inject HTML metadata", () => {
  const meta = eventMetadata({...event1, title:'<script>alert("oops")</script>'});
  assert.doesNotMatch(addEventMetadata(page,meta), /<script>/);
  assert.match(addEventMetadata(page,meta), /&lt;script&gt;/);
  assert.equal(eventMetadata({...event1,startsAt:"invalid"}),null);
});
