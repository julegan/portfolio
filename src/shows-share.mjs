// Server-rendered sharing metadata for already-published SHOWS event records.
// Link crawlers cannot see URL fragments or JavaScript-only metadata.
const PATH = "/projects/shows/";
const CARD = "https://julieowens.me/projects/shows/share-card.png";
const CANONICAL = "https://julieowens.me" + PATH;
const ZONE = "America/Los_Angeles";
const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE, weekday: "short", month: "short", day: "numeric"
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE, hour: "numeric", minute: "2-digit"
});
const entity = value => String(value ?? "").replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const compact = value => String(value ?? "").replace(/\s+/g, " ").trim();
const truncate = (value, limit) => [...compact(value)].slice(0, limit).join("");

export function parsePublishedSnapshot(source) {
  if (typeof source !== "string" || source.length > 6000000) throw Error("Unrecognized SHOWS snapshot");
  // Matches the strict reviewed JSON assignment used by trusted-shows-sync.cjs.
  const match = source.match(/window\.SHOWS_DATASET\s*=\s*(\{[\s\S]*?\});\s*window\.SHOWS_EVENTS\s*=\s*(\[[\s\S]*?\]);\s*$/);
  if (!match) throw Error("Unrecognized SHOWS snapshot format");
  if (!/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*$/.test(source.slice(0, source.indexOf("window.SHOWS_DATASET"))))
    throw Error("Unexpected executable content");
  const info = JSON.parse(match[1]);
  const events = JSON.parse(match[2]);
  if (!Array.isArray(events) || info.totalOccurrences !== events.length) throw Error("Incomplete SHOWS snapshot");
  return events;
}

function approvedImage(event) {
  const artwork = event.artwork;
  // A visible source flyer is not necessarily licensed for third-party sharing.
  // Require an explicit separate approval for promotional social previews.
  if (artwork?.usageApproved !== true || artwork?.socialSharingApproved !== true) return CARD;
  try {
    const url = new URL(artwork.url);
    const source = new URL(artwork.sourceUrl);
    if (url.protocol !== "https:" || source.protocol !== "https:" || url.username || url.password ||
        source.username || source.password) return CARD;
    return url.toString();
  } catch { return CARD; }
}

export function eventMetadata(event) {
  if (!event || typeof event.id !== "string" || !event.id || event.id.length > 240 ||
      typeof event.title !== "string" || !event.title.trim() ||
      typeof event.venue !== "string" || !event.venue.trim()) return null;
  const date = new Date(event.startsAt);
  if (!Number.isFinite(date.valueOf())) return null;
  const time = event.startTimeKind === "date-only" ? "Time TBA" :
    (event.startTimeKind === "doors" ? "Doors " :
      event.startTimeKind === "listed" ? "Listed time " : "") + timeFmt.format(date);
  const venue = compact(event.venue);
  const place = compact(event.neighborhood) || "Portland";
  const subtitle = truncate(event.subtitle || "", 100);
  const description = truncate([dateFmt.format(date), time, venue, place].join(" · ") +
    (subtitle ? " — " + subtitle : ""), 280);
  return {
    title: truncate(event.title, 150) + " — SHOWS",
    description,
    url: CANONICAL + "?event=" + encodeURIComponent(event.id),
    image: approvedImage(event)
  };
}

export function addEventMetadata(html, metadata) {
  if (!metadata || !/<\/head>/i.test(html)) return html;
  const title = entity(metadata.title), description = entity(metadata.description);
  const url = entity(metadata.url), img = entity(metadata.image);
  const tags = [
    '<link rel="canonical" href="' + url + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="SHOWS — Portland">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + img + '">',
    '<meta property="og:image:alt" content="SHOWS — Portland music and independent culture">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + title + '">',
    '<meta name="twitter:description" content="' + description + '">',
    '<meta name="twitter:image" content="' + img + '">'
  ].join("\n  ");
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>')
    .replace(/<meta name="description" content="[^"]*">/i,
      '<meta name="description" content="' + description + '">')
    .replace(/<\/head>/i, '  ' + tags + '\n</head>');
}

export async function serveEventPreview(request, env) {
  // The ASSETS binding resolves static files without invoking this Worker again.
  const page = await env.ASSETS.fetch(new Request(new URL(PATH, request.url)));
  if (!page.ok) return page;
  const requestUrl = new URL(request.url);
  const id = requestUrl.searchParams.get("event");
  if (!id || id.length > 240) return page;

  try {
    const snapshot = await env.ASSETS.fetch(new Request(new URL(PATH + "events.js", request.url)));
    if (!snapshot.ok) return page;
    const events = parsePublishedSnapshot(await snapshot.text());
    const record = events.find(e => e && e.id === id);
    const info = eventMetadata(record);
    if (!info) return page;

    const html = addEventMetadata(await page.text(), info);
    const headers = new Headers(page.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    headers.delete("ETag");
    headers.delete("Last-Modified");
    headers.delete("Content-Length");
    headers.delete("Content-Encoding");
    return new Response(html, {status: 200, headers});
  } catch {
    // Fail closed to the existing SHOWS calendar, never fabricate a preview.
    return env.ASSETS.fetch(new Request(new URL(PATH, request.url)));
  }
}
