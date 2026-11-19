// Build: copy src/ to _site/, make the pages from data/api/ (the copy of data.promptugal.news that
// scripts/sync-data.mjs keeps), stamp the version, write version.json, a markdown twin for every page and llms.txt.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev". Node 18+, no dependencies.
// Template build by factory@AgentiCCells.dinis; the pages by events.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const version = process.env.SITE_VERSION || 'dev';
const REPO = 'https://github.com/PrompTugal/PrompTugal__News__Events';
const builtAt = new Date();
const R = await import(pathToFileURL(resolve('src/assets/render.mjs')).href);
// The PrompTugal sites bar v1.1.0, vendored unchanged from PrompTugal__News__Website assets/sites-bar/1.1.0/ (dev@, designer@'s
// spec, security@'s go 90dfdd3baf; Dinis, 18 Nov 2026, the sites bar), pinned by sha256: the build stops if a file differs.
const BAR = 'src/assets/sites-bar/1.1.0/';
const BAR_SHA = {
  'sites-bar-render.mjs': 'b9b50ae32fd5dc234ba6e9b4660061afb25554b542a1c779f68d1d8c61a98dbc',
  'sites-bar.css': '302e2544eb34e3d6ce8d8e14fe2918c9f658a587f62d47d4ca20b2b4f3f7854d',
  'sites-bar.js': 'bc97a820a8f4fbda60ff65c3073be6fe79b2d1d3ee954257e3a59bca7429e9b0',
};
for (const [f, h] of Object.entries(BAR_SHA)) if (createHash('sha256').update(readFileSync(BAR + f)).digest('hex') !== h) { console.error(`build: ${BAR}${f} does not match its pinned sha256`); process.exit(1); }
const { render: renderBar } = await import(pathToFileURL(resolve(BAR + 'sites-bar-render.mjs')).href);
// The registry, copied by scripts/sync-data.mjs (if it is down, the last good copy in git is used). An empty result means no bar,
// never a hand-made one.
// The exact hosts the pages may load images from and connect to (Dinis, 19 Nov 2026: connect-src lists the exact hosts):
// this site, the data site, the page-view endpoint and lookups, and each site in the registry that passed the bar's own check.
const { check: checkRegistry } = await import(pathToFileURL(resolve(BAR + 'sites-bar-render.mjs')).href);
const SITE_HOSTS = (() => { try { return [...new Set((checkRegistry(JSON.parse(readFileSync('data/sites/sites.json', 'utf8'))) || []).map((x) => new URL(x.url).hostname))].filter((h) => /^([a-z0-9-]+\.)*promptugal\.news$/.test(h)).map((h) => `https://${h}`); } catch { return []; } })();
const CSP_SITES = [...new Set(['https://promptugal.news', 'https://data.promptugal.news', ...SITE_HOSTS])].join(' ');
const SITES_BAR = (() => { try { return renderBar(JSON.parse(readFileSync('data/sites/sites.json', 'utf8')), { here: 'events.promptugal.news' }); } catch { return ''; } })();
if (!SITES_BAR) console.warn('build: the sites registry was refused or missing: pages built without the sites bar');
const { okId, SITE, DATA, CCBY, REGION, NAMES, nameOf, lisbonDay, clean, esc, escUrl, okUrl, link, mdText, mdLink, host, fmtDay, fmtWhen, fmtStamp, addDays, readItemsOf, foundItemsOf, endOf, startOf, isCurrent, groupByDay, eventHtml, eventMd, listHtml, listMd, timePart } = R;
R.setToday(lisbonDay(builtAt));
const today = R.today;

rmSync('_site', { recursive: true, force: true });
cpSync('src', '_site', { recursive: true });

// ---------------------------------------------------------------- data
const readJson = (f, fallback = null) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return fallback; } };
const index = readJson('data/api/index.json', { places: [] });
if (!Array.isArray(index.places)) index.places = [];
const claimsIndex = readJson('data/api/claims-index.json', { places: [] });
if (!Array.isArray(claimsIndex.places)) claimsIndex.places = [];
const num = (x) => String(Math.max(0, Math.floor(Number(x) || 0)));
const eventsPt = readJson('data/api/events-pt.json', {});
const sync = readJson('data/api/sync.json', {});

// The Algarve's places, explicitly: anything else is Lisbon or beyond Portugal, never folded into the Algarve.
const ALGARVE = new Set(['albufeira', 'alcoutim', 'aljezur', 'castro-marim', 'faro', 'lagoa', 'lagos', 'loule', 'monchique', 'olhao', 'portimao', 'quarteira', 'sao-bras-de-alportel', 'silves', 'tavira', 'vila-do-bispo', 'vila-real-de-santo-antonio']);
const PORTUGAL = new Set([...ALGARVE, 'lisboa']);
const group = (p) => (ALGARVE.has(p) ? 0 : p === 'lisboa' ? 1 : 2);
const placeIds = [...new Set([...index.places.map((p) => p.id), ...claimsIndex.places.map((p) => p.place)])]
  .filter((p) => okId(p) && p !== REGION)
  .sort((a, b) => group(a) - group(b) || nameOf(a).localeCompare(nameOf(b), 'pt'));
const algarveIds = placeIds.filter((p) => ALGARVE.has(p));
const beyondIds = placeIds.filter((p) => !PORTUGAL.has(p)); // places outside Portugal (London first, Dinis 18 Nov 2026 ~22:20 UTC)
// "Beyond Portugal: <place>" is conductor.b@'s proposed label; the label and where it sits are Dinis's to change.
const placeLabel = (p) => (beyondIds.includes(p) ? `Beyond Portugal: ${nameOf(p)}` : nameOf(p));

const feeds = {};
for (const p of [...placeIds, REGION]) {
  const read = readJson(`data/api/by-place/${p}.json`, null);
  const claims = readJson(`data/api/claims/${p}.json`, null);
  feeds[p] = { read, claims };
}

// Lisbon's calendar day, for "today": the site is about Portugal.

// One shape for both kinds: "read" (details from a source we may read) and "found" (a claim found through Perplexity).
const readItems = (place) => readItemsOf(feeds[place]?.read, place);
const foundItems = (place) => foundItemsOf(feeds[place]?.claims, place);
function itemsFor(place) {
  if (place === REGION) {
    const read = readItems(REGION);
    const found = feeds[REGION]?.claims ? foundItems(REGION) : algarveIds.flatMap(foundItems);
    return [...read, ...found];
  }
  return [...readItems(place), ...foundItems(place)];
}
// ---------------------------------------------------------------- the page frame
const NAV = [['/', 'Events'], ['/places/', 'Places'], ['/sources/', 'Sources'], ['/organisers/', 'Organisers'], ['/how/', 'How it works'], ['/principles/', 'Principles']];
const pages = []; // [{path, title, md}]

function page({ path, title, description, section, body, md }) {
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: ${CSP_SITES}; connect-src 'self' ${CSP_SITES} https://dev.send.sgraph.ai https://ipapi.co https://ipwho.is; object-src 'none'; base-uri 'self'; form-action 'none'">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" type="text/markdown" href="${path}index.md">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/preview.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/sites-bar/1.1.0/sites-bar.css">
<link rel="stylesheet" href="/site.css?v=${esc(version)}">
<script defer src="/assets/sites-bar/1.1.0/sites-bar.js"></script>
<script type="module" src="/assets/live.js?v=${esc(version)}"></script>
<script defer src="/assets/obs/obs.js?v=${esc(version)}" data-lane="events"></script>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
${SITES_BAR}
<div class="version-bar"><span>Version ${esc(version)}</span><span><a href="${path}index.md">This page as markdown</a></span></div>
<header class="masthead">
  <div class="masthead-row">
    <a class="brand" href="/" aria-label="PrompTugal.news Events, home"><span class="wm">Promp<span class="t">T</span><span class="g">ugal</span>.<i>news</i></span><span class="sub">· Events</span></a>
    <a class="tool meter" href="https://promptugal.news/account/" title="This site is free and carries no billing: only promptugal.news bills (Dinis Cruz, 18 Nov 2026). Your PrompTugal.news balance is kept on promptugal.news."><span class="meter-label">Pay for what you read · </span><b>free here</b></a>
  </div>
  <nav class="nav" aria-label="Sections">${NAV.map(([h, t]) => `<a href="${h}"${h === section ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  <p>Part of <a href="https://promptugal.news/">PrompTugal.news</a>: Portugal, town by town. Independent: not an official or government site, and not a ticketing or booking service: check with the organiser before you travel.</p>
  <p class="licences">Licences: our pages, words and records <a class="lic" href="${CCBY}">CC BY 4.0</a>; each event read from a source stays under that source's licence or terms, linked on the event. Data from <a href="${DATA}/">data.promptugal.news</a> (<a href="${DATA}/sources/">what it reads</a>, <a href="${DATA}/sources/not-read/">what it does not, and why</a>).</p>
  <p class="disclaimer"><b>Your data, your say.</b> If you think we should not show your data, <a href="${REPO}/issues/new?template=report.yml">open an issue</a> and we take it down while we talk.</p>
  <p class="principles-line"><b>We aim to be accurate and never to present anything as other than it is; mistakes happen, and we correct them as soon as we can.</b> <a href="/principles/">Our principles</a> · <a href="/sources/">Every source, and why</a> · <a href="/report/">Report a mistake</a> · <a href="/security/">Security</a></p>
  <p class="small">How this page was made: code (<code>scripts/build.mjs</code>) built it from data.promptugal.news's API; the code and words are by events.b@PrompTugal.dinis, an AI agent (Claude, Opus), for Dinis Cruz; no person has checked the listings yet.</p>
  <p class="small">Version ${esc(version)} · Built ${esc(fmtStamp(builtAt.toISOString()))} · <a href="${REPO}">Source</a> · Code Apache-2.0, text CC BY 4.0 · <a href="/llms.txt">llms.txt</a></p>
</footer>
</body>
</html>
`;
  const file = join('_site', path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  writeFileSync(join('_site', path, 'index.md'), `# ${clean(title)}\n\n> ${clean(description)}\n\n${md.trim()}\n\n---\nPart of PrompTugal.news. Version ${version}. Our text and records: CC BY 4.0 (${CCBY}); each event read from a source stays under that source's terms, linked on the event. HTML: ${SITE}${path}\n`);
  pages.push({ path, title: clean(title), description: clean(description) });
}

// ---------------------------------------------------------------- counts
const stats = {};
for (const p of [...placeIds, REGION]) {
  const items = itemsFor(p).filter(isCurrent);
  stats[p] = { read: items.filter((i) => i.kind === 'read').length, found: items.filter((i) => i.kind === 'found').length };
}
const totalRead = placeIds.reduce((n, p) => n + stats[p].read, 0);
const totalFound = placeIds.reduce((n, p) => n + stats[p].found, 0);
const dataReadAt = index.read_at || sync.finished;
const discoveryAt = Object.values(feeds).map((f) => f.claims?.discovery?.asked_at).filter(Boolean).sort().pop();
const sourcesRead = (eventsPt.provenance?.sources || []).map((s) => `${s.what} (${s.host})`);
const fresh = `<p class="fresh">Events data read from data.promptugal.news ${esc(fmtStamp(dataReadAt))}${discoveryAt ? `; Perplexity last asked ${esc(fmtStamp(discoveryAt))}` : ''}. "Today" here is ${esc(fmtDay(today))}, Lisbon time, the day this page was built.</p>`;
const lisbonNote = (() => {
  const g = (eventsPt.gaps || []).find((x) => x.host === 'www.agendalx.pt');
  return g ? `Lisbon's agenda (agendalx.pt, Câmara Municipal de Lisboa) answered "${esc(g.why)}" at the last read (${esc(fmtStamp(g.read_at))}), so Lisboa lists nothing today: that means no source, not no events.` : '';
})();
function counts(p) {
  const s = stats[p];
  if (!s.read && !s.found) return '<span class="none">nothing yet</span>';
  return [s.read ? `${s.read} read` : '', s.found ? `${s.found} found through Perplexity` : ''].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- home
{
  const week = addDays(today, 7);
  const algItems = [...itemsFor(REGION), ...itemsFor('lisboa'), ...beyondIds.flatMap((p) => itemsFor(p))]
    .filter((it) => startOf(it) >= today && startOf(it) < week);
  const wk = listHtml(algItems, { showPlace: true });
  const placeRows = [REGION, ...placeIds].map((p) => `<li><a href="/places/${p}/">${esc(placeLabel(p))}</a>${p === REGION ? ' <span class="small">(every Algarve place together)</span>' : ''} <span class="small">${counts(p)}</span></li>`).join('\n');
  page({
    path: '/', section: '/', title: "PrompTugal.news Events: what's on, town by town",
    description: `Events across Portugal, town by town: ${totalRead} read from official agendas and ${totalFound} found through Perplexity, for the Algarve's places and Lisbon, each with its evidence and licence.`,
    body: `<section class="hero">
<p class="kicker">Events · Portugal, town by town</p>
<h1>What's on in the Algarve and Lisbon${beyondIds.length ? ', and beyond Portugal' : ''}</h1>
<p class="standfirst">${totalRead} events read from official agendas and ${totalFound} more found through Perplexity, across ${placeIds.length} places. Every event shows its date, place, venue and organiser where a source we may read gives them, the evidence for it, and its licence.</p>
${fresh}
<p class="note">Two kinds of listing: <b>read</b> events come from a public agenda we may read (the agendas data.promptugal.news reads: ${esc(sourcesRead.join(' and ') || 'none yet')}), with the details it gives; events <b>found through Perplexity</b> show only their title, date, place and the links that point to them, because the sites those links lead to do not let us copy their details. <a href="/organisers/">Organisers: send us yours.</a></p>
</section>
<section><h2>Places</h2><ul class="places">${placeRows}</ul>${lisbonNote ? `<p class="small">${lisbonNote}</p>` : ''}</section>
<section><h2>Starting in the next seven days</h2><p class="fresh" id="events-status">Built copy: data read ${esc(fmtStamp(dataReadAt))}. Your browser loads the live file when it can.</p><div id="events" data-places="${["algarve", "lisboa", ...beyondIds].join(",")}" data-window="7" data-show-place="1" data-read-at="${esc(dataReadAt || '')}">${wk.count ? wk.html : '<p class="none">Nothing listed yet for the next seven days.</p>'}</div><p class="small">Long-running exhibitions and events already on are on each place's page, under "On now".</p></section>`,
    md: `${totalRead} events read from official agendas and ${totalFound} found through Perplexity, across ${placeIds.length} places. Data read ${fmtStamp(dataReadAt)}.\n\n## Places\n\n${[REGION, ...placeIds].map((p) => `- ${mdLink(`${SITE}/places/${p}/`, nameOf(p))}: ${counts(p).replace(/<[^>]+>/g, '')}`).join('\n')}\n\n## Starting in the next seven days\n\n${listMd(algItems) || 'Nothing listed yet.'}`,
  });
}

// ---------------------------------------------------------------- places index and one page per place
page({
  path: '/places/', section: '/places/', title: 'Places: PrompTugal.news Events',
  description: "Every place the events site covers: the Algarve's towns and Lisbon, with how many events each lists.",
  body: `<h1>Places</h1><p class="standfirst">The Algarve's places and Lisbon first; more as data.promptugal.news reads more agendas.</p>${fresh}
<table class="places-table"><thead><tr><th scope="col">Place</th><th scope="col">Read from an agenda</th><th scope="col">Found through Perplexity</th></tr></thead><tbody>
${[REGION, ...placeIds].map((p) => `<tr><th scope="row"><a href="/places/${p}/">${esc(placeLabel(p))}</a></th><td class="n">${stats[p].read}</td><td class="n">${stats[p].found}</td></tr>`).join('\n')}
</tbody></table>
<p class="small">Counts are events on now or still to come. "The Algarve" gathers every Algarve place. A zero means no source we may read covers the place yet, not that nothing is on: see <a href="/how/">how it works</a> and <a href="${DATA}/sources/gaps/">the sources we do not read</a>.</p>`,
  md: [REGION, ...placeIds].map((p) => `- ${mdLink(`${SITE}/places/${p}/`, nameOf(p))}: ${stats[p].read} read, ${stats[p].found} found through Perplexity`).join('\n'),
});

for (const p of [REGION, ...placeIds]) {
  const items = itemsFor(p);
  const L = listHtml(items, { showPlace: p === REGION });
  const read = feeds[p].read, cl = p === REGION ? null : feeds[p].claims;
  const nm = nameOf(p);
  const apiLinks = [read ? link(`${DATA}/api/v1/events/by-place/${p}.json`, `events read (${p}.json)`) : '', cl ? link(`${DATA}/api/v1/events/claims/by-place/${p}.json`, `events found (claims/${p}.json)`) : ''].filter(Boolean).join(' · ');
  const empty = p === 'lisboa' && lisbonNote ? lisbonNote : `No source we may read lists events for ${esc(nm)} yet, and Perplexity found none. That means no source, not no events: <a href="${DATA}/sources/gaps/">the sources we do not read</a>. <a href="/organisers/">Organisers: send us yours.</a>`;
  page({
    path: `/places/${p}/`, section: '/places/',
    title: `${nm}: events, by day · PrompTugal.news Events`,
    description: `Events in ${nm} by day: ${stats[p].read} read from official agendas, ${stats[p].found} found through Perplexity, each with its date, venue, organiser, evidence and licence.`,
    body: `<p class="crumbs"><a href="/places/">Places</a> › ${esc(nm)}</p>
<h1>${esc(nm)}${p === REGION ? ': every place' : ''}</h1>
<p class="standfirst"><span data-count="read">${stats[p].read}</span> events read from official agendas${stats[p].found ? ` and <span data-count="found">${stats[p].found}</span> found through Perplexity` : ''}, on now or starting within about 60 days, by day.</p>
${fresh}
${read?.source_note && stats[p].read ? `<details class="small"><summary>The sources and their terms</summary><p>${esc(read.source_note)}</p></details>` : ''}
<p class="fresh" id="events-status">Built copy: data read ${esc(fmtStamp(dataReadAt))}. Your browser loads the live file when it can.</p>
<div id="events" data-places="${p}" data-show-place="${p === REGION ? 1 : 0}" data-read-at="${esc(dataReadAt || '')}">${L.count ? L.html : `<p class="none">${empty}</p>`}</div>
<p class="small">The data: ${apiLinks || 'none yet'}. ${p === REGION ? `The Algarve's Perplexity finds are gathered from each place's own file.` : ''} Licences: the records CC BY 4.0, each event under its source's terms as linked.</p>`,
    md: `${stats[p].read} read from official agendas, ${stats[p].found} found through Perplexity. Data read ${fmtStamp(dataReadAt)}.\n\n${listMd(items) || 'No events listed yet: no source we may read covers this place.'}`,
  });
}

// ---------------------------------------------------------------- organisers
page({
  path: '/organisers/', section: '/organisers/', title: 'Organisers: send us your event · PrompTugal.news Events',
  description: 'How an organiser sends its own event to PrompTugal.news Events: published, credited and dated as the organiser\'s own, and signed later.',
  body: `<h1>Organisers: send us your event</h1>
<p class="standfirst">If your event is listed here with "details withheld", it is because the only places we found it do not let us copy their details. Send them to us yourself and we publish them, credited to you and dated.</p>
<section><h2>What happens to what you send</h2>
<ul>
<li><b>Published as yours.</b> Your event appears on its place's page with your organisation named as the organiser and the source, the date you sent it, and a link to your own page for it.</li>
<li><b>Under the licence you choose.</b> Tell us the licence for your text (we suggest CC BY 4.0, as ours); we show it on the event.</li>
<li><b>Signed, later.</b> We will let organisers sign what they send with their own key (PKI, as our agents sign their work), so a reader can check it came from you. Not yet: added as we go.</li>
<li><b>Only from the organiser.</b> We publish an event's details on the organiser's word. Details sent by someone else are a lead we check at a source we may read, never published on their word alone (a proposal, waiting for Dinis Cruz's decision).</li>
<li><b>Public and professional only.</b> An organisation's name and its public channels; never a private person's phone or address.</li>
</ul></section>
<section><h2>What to send</h2>
<p>One event per message, with: its name; its start and end (date, and time if it has one); the town and the venue; your organisation's name and website; the link to the event's own page; a short description if you want one shown; the licence for your text.</p>
<p>If you already publish your events as a feed (iCal or RSS) or as schema.org <code>Event</code> data on your site, tell us its address: <a href="${DATA}/">data.promptugal.news</a> can read it regularly, once its terms allow.</p>
<pre class="code">{
  "@type": "Event",
  "name": "Your event",
  "startDate": "2026-12-05T18:00",
  "endDate": "2026-12-05T21:00",
  "location": { "@type": "Place", "name": "The venue", "address": "Street, town" },
  "organizer": { "@type": "Organization", "name": "Your organisation", "url": "https://example.org/" },
  "url": "https://example.org/events/your-event",
  "license": "https://creativecommons.org/licenses/by/4.0/"
}</pre></section>
<section><h2>Where to send it</h2>
<p><a class="button" href="${REPO}/issues/new?template=event.yml">Send us your event</a></p><p>It opens a short form on this site's public repository (a GitHub issue; you need a GitHub account). Send it from an account that is your organisation's or that your organisation's site names. Everything you post there is public. This is the channel Dinis Cruz chose on 18 November 2026; we will revisit it as more organisers send events.</p>
<p class="small">Written by events.b@PrompTugal.dinis (an AI agent) from Dinis Cruz's rule of 18 November 2026 ("When he sends his own details, we publish them, credited ... eventually we want to have PKI here").</p></section>`,
  md: `If your event is listed with "details withheld", send its details yourself and we publish them, credited to you and dated.\n\n- Published as yours, credited and dated, with a link to your page.\n- Under the licence you choose (we suggest CC BY 4.0).\n- Signed later (PKI), added as we go.\n- Only from the organiser; a third party's details are a lead to check (a proposal for Dinis Cruz).\n\nSend: name; start and end; town and venue; your organisation and website; the event's link; an optional short description; the licence. Where: the form at ${REPO}/issues/new?template=event.yml (a public GitHub issue).`,
});

// ---------------------------------------------------------------- how it works
{
  const srcs = (eventsPt.provenance?.sources || []).map((s) => `<li>${link(s.route, s.what)} <span class="small">(${esc(s.host)}): ${esc(s.terms)}</span></li>`).join('\n');
  const gaps = (eventsPt.gaps || []).map((g) => `<li><b>${esc(g.host)}</b>: ${esc(g.why)} <span class="small">(${esc(fmtStamp(g.read_at))})</span></li>`).join('\n');
  const claimTotals = claimsIndex.places.reduce((a, p) => ({ claims: a.claims + (p.claims || 0), withheld: a.withheld + (p.withheld || 0), confirmed: a.confirmed + (p.confirmed || 0) }), { claims: 0, withheld: 0, confirmed: 0 });
  page({
    path: '/how/', section: '/how/', title: 'How it works: the data and its provenance · PrompTugal.news Events',
    description: 'Where the events on this site come from, what we may show from each source, how events are found through Perplexity, where the data lives, and the graph it feeds.',
    body: `<h1>How it works</h1>
<p class="standfirst">This site runs no collector of its own. Everything on it comes from <a href="${DATA}/">data.promptugal.news</a>, the PrompTugal.news data site, which reads public sources, keeps each value with its source and the time read, and publishes it as an open API. This site turns that into pages.</p>
${fresh}
<section><h2>Two phases: look, then publish what we may</h2>
<ol>
<li><b>Read.</b> data.promptugal.news reads public agendas it may read, by their own supported routes (an API, a feed, the public list page), respecting robots.txt and terms. Today: <ul>${srcs || '<li>none</li>'}</ul> Those events carry their details: date, venue, organiser where named, the link to the event, and the source's licence or terms.</li>
<li><b>Look.</b> Once a day per place, it asks Perplexity (the sonar model, through OpenRouter) what is on, and keeps every link Perplexity cites as evidence. Today that gives ${claimTotals.claims} claims across the places, ${claimTotals.withheld} with details withheld and ${claimTotals.confirmed} confirmed at a source we may read.</li>
<li><b>Publish what we may.</b> An event found only through Perplexity shows its title, date and place, as a search engine would, credited "found through Perplexity", with every evidence link and whether we may read that source. Its details are withheld until a source we may read, or the organiser, gives them. Nothing Perplexity says is published as fact.</li>
</ol>
<p>Every cited site we do not read is a gap: data.promptugal.news counts them on <a href="${DATA}/sources/gaps/">the gaps page</a>, and each feeds a request, on the record, asking that site whether it allows a site like this to show its public events (drafted by an agent, sent by a person).</p></section>
<section><h2>Sources we do not read for events</h2><ul>${gaps || '<li>none recorded</li>'}</ul>
<p>Every source, read and not, with why and its licence limits, each linkable: <a href="/sources/">our sources page</a>. The whole register on the data site: <a href="${DATA}/sources/">every source data.promptugal.news reads</a>, <a href="${DATA}/sources/not-read/">every one it does not, and why</a>, quoting the terms or robots.txt with the date read. We respect what each says. Eventbrite, Luma (lu.ma, luma.com) and Meetup are never read by machine, at Dinis Cruz's word, until he decides otherwise; their listings can appear here only as evidence links.</p></section>
<section><h2>Licences</h2>
<ul><li>What PrompTugal.news makes (these pages, our words, the records and the register) is <a class="lic" href="${CCBY}">CC BY 4.0</a>.</li>
<li>What we take from someone else stays under their licence: every event, in the JSON and on the page, links its licence, or, where the source publishes none, its terms, as "the source's terms". The agendas read today publish no reuse licence; Lisbon's sets <code>use=reference</code> in its robots.txt, so we name the source and link to each event. Whether that is enough to republish is for Dinis Cruz to decide (<a href="${DATA}/api/v1/events-pt/card.json">the source card</a>).</li>
<li>House style: we print no em dashes, so a source's em dash shows here as an en dash; the JSON keeps the original.</li></ul></section>
<section><h2>Where the data lives</h2>
<ul>
<li>The API: <a href="${DATA}/api/v1/events/by-place/index.json">events by place</a> (read), <a href="${DATA}/api/v1/events/claims/by-place/index.json">claims by place</a> (found through Perplexity), <a href="${DATA}/api/v1/discovery/">the discovery answers</a> (model, time, prompt, every cited link and the cost), <a href="${DATA}/api/v1/events-pt/card.json">the events source card</a>, and <a href="${DATA}/how/">how data.promptugal.news works</a>.</li>
<li>This site's copy: <code>data/api/</code> in <a href="${REPO}">this repository</a>, refreshed by <code>scripts/sync-data.mjs</code> before every build, with <code>data/api/sync.json</code> recording when each file was read.</li>
<li>Collected by code, no model, except the discovery (Perplexity's sonar, through OpenRouter, a small daily budget). The collectors and the discovery are data.b@PrompTugal.dinis's; this site's code and words are events.b@PrompTugal.dinis's. No person has checked the listings yet.</li>
</ul></section>
<section id="threat-models"><h2>Threat models</h2><p>For each automation this site runs, what it reads, writes and trusts, what could go wrong and how we guard against it: ${["sync-data", "scheduled-rebuild", "live-data", "issue-forms"].map((n) => link(`${REPO}/blob/dev/docs/threat-models/${n}.md`, n)).join(", ")}. Findings, fixed and open: <a href="/security/">security</a>.</p></section>
<section><h2>The graph</h2>
<p>Each event will link to its <b>place</b>, its <b>venue</b>, its <b>organiser</b> (an organisation), its <b>past editions</b> (an event series: an event is never deleted when it ends, it moves to the series' history), and the <b>companies</b> and public, professional <b>people</b> connected to it. ontologist@ and data.b@ define the graph on data.promptugal.news (<code>/api/v1/graph/</code>, not published yet); this site will show it when it is.</p>
<p class="small">Today the records give place and venue; the organiser is named only where the agenda names one; past editions and companies are not linked yet.</p></section>`,
    md: `This site runs no collector. Everything comes from ${DATA}/ (data.promptugal.news), which reads public agendas it may read and asks Perplexity once a day per place what is on, keeping every cited link as evidence.\n\n- Read events: details from sources we may read (${sourcesRead.join('; ')}).\n- Found through Perplexity: title, date, place and evidence links only; details withheld.\n- Licences: ours CC BY 4.0; each event under its source's terms.\n- Register: ${DATA}/sources/ and ${DATA}/sources/not-read/; gaps: ${DATA}/sources/gaps/\n- The graph (event, venue, organiser, past editions, places, companies): defined by ontologist@ and data.b@, not published yet.`,
  });
}

// ---------------------------------------------------------------- sources, principles, report (Dinis, 18 Nov 2026 ~14:45 UTC,
// board/guidance/2026-11-18-sources-principles-and-reports.md)
const TELL_US = `<aside class="tell-us" role="note"><p><b>Tell us, and we change.</b> If a source here is wrong, if you run one of these sources and want it read, shown differently or not at all, or if you think we have its terms wrong, <a href="/report/">tell us</a>. We will look, answer, and change what is wrong, in the open. <a href="/principles/">Our principles</a>.</p></aside>`;
{
  const reg = readJson('data/api/sources/index.json', { entries: [] });
  const gapsF = readJson('data/api/sources/gaps.json', { hosts: [] });
  const src = (Array.isArray(reg.entries) ? reg.entries : []).filter((e) => e && okId(e.id)).map((e) => readJson(`data/api/sources/${e.id}.json`, e)).filter((s) => s && typeof s === 'object' && okId(s.id)).map((s) => ({ ...s, name: String(s.name || s.id), gives: Array.isArray(s.gives) ? s.gives : [], places: Array.isArray(s.places) ? s.places.filter(okId) : [] }));
  const STATUS = { read: 'read', 'not-read': 'not read', asked: 'asked', allowed: 'allowed', refused: 'refused', 'no-answer': 'no answer' };
  const givesEvents = (s) => (s.gives || []).some((g) => /event/i.test(g));
  const placesText = (s) => (s.places || []).map((p) => (p === 'portugal' ? 'Portugal' : nameOf(p))).join(', ');
  const quote = (w) => (w.quote ? `<blockquote${w.quote_lang ? ` lang="${esc(w.quote_lang)}"` : ''}>${esc(w.quote)}</blockquote>` : w.text ? `<p>${esc(w.text)}</p>` : '');
  const card = (s) => {
    const read = s.status === 'read';
    const w = s.why || {};
    const limits = read
      ? `<dt>Licence limits</dt><dd>${esc(s.terms?.summary || 'not recorded')}${s.terms?.page ? ` (${link(s.terms.page, 'read')} ${esc(s.terms.read_at || '')})` : ''}</dd>`
      : `<dt>Licence limits</dt><dd>We copy nothing from it. At most, its public link appears as evidence beside an event's title, date and place, as a search engine would.</dd>`;
    const why = read ? '' : `<dt>Why not</dt><dd><span class="basis">${esc(w.basis || 'not recorded')}</span>${quote(w)}<span class="small">${w.page ? link(w.page, 'the page it comes from') : ''}${w.read_at ? `, read ${esc(w.read_at)}` : ''}</span></dd>`;
    const checks = (s.open_checks || []).map((c) => `<li>${esc(c.question)} <span class="small">(${esc(c.state || '')})</span></li>`).join('');
    return `<li class="src src-${read ? 'read' : 'not'}" id="${s.id}">
<h4><a class="anchor" href="#${s.id}" aria-label="Link to this source">#</a> ${link(s.url, s.name)} <span class="flag ${read ? 'ok' : 'no'}">${esc(STATUS[s.status] || s.status)}</span>${givesEvents(s) ? ' <span class="flag">events</span>' : ''}</h4>
<dl class="ev-facts"><dt>Kind</dt><dd>${esc(s.kind || '')}</dd><dt>Owner</dt><dd>${esc(s.owner || 'not known')}</dd><dt>Places</dt><dd>${esc(placesText(s))}</dd><dt>Would give</dt><dd>${esc((s.gives || []).join('; '))}</dd>
${read ? `<dt>How we read it</dt><dd>${esc(s.how || '')}${s.on_this_site ? ` (${link(s.on_this_site, 'its card')})` : ''}</dd>` : ''}${why}${limits}
${!read && s.interface ? `<dt>Interface</dt><dd>${esc(s.interface)}</dd>` : ''}${s.cited_by ? `<dt>Cited by</dt><dd>${num(s.cited_by.claims)} events found through Perplexity, in ${(s.cited_by.places || []).length} places</dd>` : ''}
<dt>Asked them?</dt><dd>${['asked', 'allowed', 'refused', 'no-answer'].includes(s.status) ? esc(STATUS[s.status]) : 'not yet: a request on the record, through its own published channel, drafted by an agent and sent by a person'}</dd>
${s.notes ? `<dt>Notes</dt><dd>${esc(s.notes)}</dd>` : ''}${checks ? `<dt>Open</dt><dd><ul>${checks}</ul></dd>` : ''}
<dt>Record</dt><dd>${link(`${DATA}/api/v1/sources/${s.id}.json`, `${s.id}.json`)}${s.researched_by ? ` <span class="small">researched by ${esc(s.researched_by)}</span>` : ''}</dd></dl>
</li>`;
  };
  const readS = src.filter((s) => s.status === 'read');
  const notS = src.filter((s) => s.status !== 'read').sort((a, b) => (b.cited_by?.claims || 0) - (a.cited_by?.claims || 0) || givesEvents(b) - givesEvents(a) || a.name.localeCompare(b.name));
  const byBasis = {};
  for (const s of notS) { const k = (s.why?.basis || 'not recorded').replace(/[:(].*$/, '').trim(); byBasis[k] = (byBasis[k] || 0) + 1; }
  const regIds = new Set(src.map((s) => s.id));
  const hosts = (Array.isArray(gapsF.hosts) ? gapsF.hosts : []).filter((h) => h && typeof h.host === 'string').map((h) => ({ ...h, places: Array.isArray(h.places) ? h.places.filter(okId) : [] }));
  const unreg = hosts.filter((h) => !h.register || !regIds.has(h.register)).sort((a, b) => Number(b.claims || 0) - Number(a.claims || 0));
  const regGaps = hosts.filter((h) => h.register && regIds.has(h.register));
  page({
    path: '/sources/', section: '/sources/', title: 'Every source: read, not read, and why · PrompTugal.news Events',
    description: `Every source PrompTugal.news knows of: ${readS.length} we read and ${notS.length} we do not, each with why not, its licence limits and the rules we follow; plus ${unreg.length} sites Perplexity cited that are not on the register yet.`,
    body: `<h1>Every source: what we read, what we do not, and why</h1>
<p class="standfirst">Every source PrompTugal.news knows of, for events and for everything else the PrompTugal sites show: ${readS.length} we read today and ${notS.length} we do not, each with the reason, quoted from its own terms or robots.txt with the link and the date read. We respect what each says.</p>
${TELL_US}
<p class="disclaimer"><b>Your data, your say.</b> If you think we should not show your data, <a href="${REPO}/issues/new?template=report.yml">open an issue</a> and we take it down while we talk.</p>
<p class="fresh">From the register on data.promptugal.news, read ${esc(fmtStamp(sync.finished))}. Each source has its own link: <code>${SITE}/sources/#&lt;id&gt;</code>.</p>
<nav class="toc" aria-label="On this page"><a href="#read">We read (${readS.length})</a> · <a href="#not-read">We do not read (${notS.length})</a> · <a href="#cited">Cited, not on the register (${unreg.length})</a> · <a href="#limits">Licence limits</a> · <a href="#rules">The rules we follow</a></nav>
<section id="read"><h2>Sources we read (${readS.length})</h2><p>Read by code through the interface each offers (an open-data API, a public list page), politely, and only where its robots.txt and terms allow. What we show from each follows its licence or terms, stated on the source and on every item.</p><ul class="srcs">${readS.map(card).join('\n')}</ul></section>
<section id="not-read"><h2>Sources we do not read (${notS.length})</h2>
<p>Why, in short: ${Object.entries(byBasis).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)} (${n})`).join('; ')}. A robots.txt rule is an access rule, not a licence, and we follow it; a bot check or a refusal is respected, never worked around; a house rule is Dinis Cruz's, until he decides otherwise. The most cited by the events we found come first.</p>
<ul class="srcs">${notS.map(card).join('\n')}</ul></section>
<section id="cited"><h2>Cited by Perplexity, not on the register yet (${unreg.length})</h2>
<p>Sites Perplexity cited as evidence for an event, that we do not read and have not yet researched. Each is a gap: its terms go on the register next, then a request on the record. Counts are the events found that point to it.</p>
<table class="places-table"><thead><tr><th scope="col">Site</th><th scope="col">Events</th><th scope="col">Places</th></tr></thead><tbody>
${unreg.map((h) => `<tr id="host-${esc(h.host.replace(/[^a-z0-9]+/gi, '-'))}"><th scope="row">${link(h.example || `https://${h.host}/`, h.host)}</th><td class="n">${num(h.claims)}</td><td>${esc((h.places || []).map(nameOf).join(', '))}</td></tr>`).join('\n')}
</tbody></table>
${regGaps.length ? `<p class="small">Also cited and already on the register: ${regGaps.map((h) => `<a href="#${okId(h.register) ? h.register : ''}">${esc(h.host)}</a> (${num(h.claims)})`).join(', ')}.</p>` : ''}</section>
<section id="limits"><h2>Licence limits, in short</h2>
<ul>
<li><b>What we make</b> (our pages, words, records, this register) is <a class="lic" href="${CCBY}">CC BY 4.0</a>: reuse it with credit.</li>
<li><b>What we read from a source</b> stays under its licence or terms, linked on every item. Where a source publishes none, we say "the source's terms" and link them; we never assume it is open.</li>
<li><b>The agendas we read for events</b> (Câmara Municipal de Lagos, and Lisbon's Agenda LX when it answers) publish no reuse licence; Lisbon's robots.txt asks for reference use. So we name the source, link each event to its own page, and show its title, dates and venue. Whether that is enough is Dinis Cruz's decision, recorded on <a href="${DATA}/api/v1/events-pt/card.json">the source card</a>.</li>
<li><b>Sources we do not read</b>: nothing copied. At most a link, as evidence.</li>
</ul></section>
<section id="rules"><h2>The rules we follow</h2><p>In full on <a href="/principles/#rules">our principles</a>: public sources only, through supported interfaces; robots.txt, terms and refusals respected; a licence on everything; credit for how we found it; asking on the record; public and professional only.</p></section>`,
    md: `${readS.length} sources read, ${notS.length} not read, ${unreg.length} cited by Perplexity and not on the register yet. Tell us, and we change: ${SITE}/report/\n\n## Read\n\n${readS.map((s) => `- ${mdLink(s.url, s.name)} (${s.kind}): ${mdText(s.terms?.summary || '')}`).join('\n')}\n\n## Not read\n\n${notS.map((s) => `- ${mdLink(s.url, s.name)} (${s.kind}): ${mdText(s.why?.basis || '')}${s.why?.quote ? `: "${mdText(s.why.quote)}"` : s.why?.text ? `: ${mdText(s.why.text)}` : ''}${s.why?.page ? ` (${mdLink(s.why.page, 'source')}, ${mdText(s.why.read_at || '')})` : ''}`).join('\n')}\n\n## Cited, not on the register\n\n${unreg.map((h) => `- ${mdText(h.host)}: ${num(h.claims)} events`).join('\n')}`,
  });
}

page({
  path: '/principles/', section: '/principles/', title: 'Our principles and rules of engagement · PrompTugal.news Events',
  description: 'What PrompTugal.news Events aims for: accurate, never presenting anything as other than it is, mistakes corrected as soon as possible and in the open; and the rules we follow with every source.',
  body: `<h1>Our principles</h1>
<p class="standfirst">We aim to be accurate. We aim never to present anything as other than it is. Mistakes will happen; when they do, we correct them as soon as we can, and say so.</p>
${TELL_US}
<section id="principles"><h2>What we aim for</h2>
<ol class="principles">
<li id="accurate"><b>Accurate.</b> Every fact has its source, the link and the time it was read. If we cannot source it, we do not state it.</li>
<li id="as-it-is"><b>Never presented as other than it is.</b> What a source says is shown as that source's; what we found but could not confirm is marked as found, not confirmed; what an AI agent wrote says so and names the agent and model; nothing is called checked by a person unless a person checked it. We are not an official or government site, and never say we are.</li>
<li id="provenance"><b>Provenance shown.</b> Where each piece of data came from, how it was read, where it is kept and how to reach it, on every page and in every file (<a href="/how/">how it works</a>).</li>
<li id="licences"><b>Licences shown.</b> What we make is Creative Commons (CC BY 4.0). What we take stays under its owner's licence, linked on every item; "the source's terms" where there is none; never assumed open.</li>
<li id="corrections"><b>Mistakes corrected, in the open.</b> When something is wrong we fix it as soon as we can and record it, dated, on <a href="/report/#log">the corrections log</a>. We do not quietly rewrite.</li>
<li id="listen"><b>We listen and change.</b> A reader, an organiser or a source that tells us something is wrong gets an answer, and the site changes when they are right. Our own rules change too, in the open.</li>
<li id="people"><b>Public and professional only.</b> Organisations and their public channels; never a private person's contact, never anything from behind a login.</li>
</ol></section>
<section id="rules"><h2>The rules of engagement we follow with sources</h2>
<ol class="principles">
<li><b>Public sources, through supported interfaces:</b> an open-data API, a feed (iCal, RSS), a public list page. Never behind a login.</li>
<li><b>robots.txt, terms and refusals are respected.</b> A disallow, a bot check, a 403 or a "please don't" is followed and recorded on <a href="/sources/#not-read">the sources page</a> with the quote and the date, never worked around.</li>
<li><b>Read politely:</b> a named user agent, pauses between requests, back off on errors, no more often than the data changes.</li>
<li><b>Some platforms are never read by machine</b> (Eventbrite, Luma, Meetup, websummit.com) until Dinis Cruz decides otherwise: a house rule. Their public links can appear as evidence only.</li>
<li><b>Show only what we may.</b> From a source we do not read: a title, date, place and link, as a search engine would; no text, no images, no details.</li>
<li><b>Credit how we found it.</b> An event found through Perplexity says so, with every link it cited. Perplexity and the other services we use will be told, on the record, how we use them.</li>
<li><b>Ask on the record.</b> Every source we do not read gets, in time, a short public question through its own published channel: may a site like this show your public events, and how? Drafted by an agent, sent by a person; the answer, or none after 14 days, goes on the register as written.</li>
<li><b>Organisers own their events.</b> An organiser's own details are published as theirs, credited and dated; signed with their key later. Someone else's details are a lead we check, never published on their word alone.</li>
<li><b>A source that asks to be left out is left out,</b> at once, and the request recorded.</li>
</ol></section>
<section><h2>Where these come from</h2>
<p>Dinis Cruz's guidance of 18 November 2026 (licences and submissions, the two phases, the sources register, and these principles), kept word for word in the <a href="https://github.com/PrompTugal/PrompTugal__News__Website/tree/dev/board/guidance">PrompTugal.news board</a> and in <a href="${REPO}/tree/dev/board/guidance">this site's</a>. Written up by events.b@PrompTugal.dinis, an AI agent; meant to become every PrompTugal site's, and proposed to the team for that.</p></section>`,
  md: `We aim to be accurate. We aim never to present anything as other than it is. Mistakes will happen; we correct them as soon as we can, and say so. Tell us: ${SITE}/report/\n\n## What we aim for\n\n1. Accurate: every fact sourced, linked and dated.\n2. Never presented as other than it is: source's vs ours, found vs confirmed, AI vs person; not official.\n3. Provenance shown.\n4. Licences shown: ours CC BY 4.0; theirs stays theirs.\n5. Mistakes corrected in the open (corrections log).\n6. We listen and change.\n7. Public and professional only.\n\n## Rules of engagement\n\n1. Public sources, supported interfaces.\n2. robots.txt, terms and refusals respected, never worked around.\n3. Read politely.\n4. Eventbrite, Luma, Meetup, websummit.com never read by machine (house rule).\n5. From sources we do not read: title, date, place, link only.\n6. Credit how we found it (Perplexity).\n7. Ask on the record.\n8. Organisers own their events.\n9. A source that asks to be left out is left out.`,
});

{
  const corr = readJson('data/corrections.json', { corrections: [] }).corrections || [];
  page({
    path: '/report/', section: '/report/', title: 'Report a mistake or a concern · PrompTugal.news Events',
    description: 'How to tell PrompTugal.news Events that something is wrong: what to send, where, what happens next, and the log of every correction.',
    body: `<h1>Report a mistake or a concern</h1>
<p class="standfirst">Something wrong, out of date, unfair, or not ours to show? Tell us. We will look, answer, and change what is wrong.</p>
<section id="what"><h2>What you can report</h2>
<ul>
<li>A wrong date, place, venue, organiser or link on an event; an event that is cancelled, moved or never existed.</li>
<li>You run a source listed here and want it read, shown differently, or left out; or we have your terms wrong.</li>
<li>You organise an event and want to send its details (see <a href="/organisers/">organisers</a>).</li>
<li>A licence or credit that is missing or wrong.</li>
<li>Anything about a person that should not be here.</li>
<li>Anything else that breaks <a href="/principles/">our principles</a>.</li>
</ul></section>
<section id="how"><h2>How</h2>
<p><a class="button" href="${REPO}/issues/new?template=report.yml">Report it</a></p><p>It opens a short form on this site's public repository (a GitHub issue; you need a GitHub account). <b>If you think we should not show your data, say so: we take it down while we talk.</b> Say which page (its link), what is wrong, and, if you can, a public link that shows what is right. Everything posted there is public.</p>
<p><b>If it should not be public</b> (a private detail about a person, say), write instead to <a href="mailto:agent@riskmandate.ai">agent@riskmandate.ai</a>, a monitored inbox, or give only the page's link and the words "please take down" in an issue. We take it down first and ask afterwards. An encrypted drop (a form that encrypts in your browser, readable only by the team's conductor and Dinis Cruz) is coming; this page will link it when it is live.</p></section>
<section id="next"><h2>What happens next</h2>
<ol>
<li><b>Take down first, where it matters:</b> anything about a person, or a source asking to be left out, comes off at the next release, before we look further.</li>
<li><b>Look:</b> we check the report against the source.</li>
<li><b>Answer:</b> on the issue, saying what we found.</li>
<li><b>Change:</b> fix what is wrong, or explain why we think it is right.</li>
<li><b>Record:</b> every correction goes on the log below, dated, with what changed. A source's answer goes on its register entry.</li>
</ol>
<p class="small">We aim to answer within a day. The site is run by AI agents with Dinis Cruz as the person responsible; a report about the agents' work reaches him.</p></section>
<section id="log"><h2>Corrections log</h2>
${corr.length ? `<ul>${corr.map((c) => `<li><b>${esc(c.date || '')}</b> ${esc(c.page || '')}: ${esc(c.what || '')}${c.changed ? `. Changed: ${esc(c.changed)}` : ''}</li>`).join('\n')}</ul>` : '<p class="none">No corrections yet. This log started on 18 November 2026; when there is one, it is here, dated, and never removed.</p>'}
<p class="small">The log as data: <a href="${REPO}/blob/dev/data/corrections.json">data/corrections.json</a> (CC BY 4.0).</p></section>`,
    md: `Something wrong? Tell us: ${REPO}/issues/new?template=report.yml (public), or privately at agent@riskmandate.ai (a monitored inbox). If you think we should not show your data, we take it down while we talk. If it should not be public, write to agent@riskmandate.ai, or give only the page's link and "please take down".\n\nWhat happens: take down first where it matters; look; answer; change; record on the corrections log.\n\n## Corrections log\n\n${corr.length ? corr.map((c) => `- ${c.date}: ${mdText(c.page || '')}: ${mdText(c.what || '')}`).join('\n') : 'No corrections yet (log started 18 November 2026).'}`,
  });
}

// ---------------------------------------------------------------- security (Dinis, 18 Nov 2026 ~15:15 UTC, Website board/guidance/2026-11-18-security-findings-published.md)
{
  const S = readJson('data/security/findings.json', { findings: [] });
  const list = Array.isArray(S.findings) ? S.findings : [];
  const SEV = { high: 3, medium: 2, low: 1 };
  const sorted = [...list].sort((a, b) => (a.state === 'open') - (b.state === 'open') || (SEV[b.severity] || 0) - (SEV[a.severity] || 0));
  const tm = existsSync('docs/threat-models') ? readdirSync('docs/threat-models').filter((f) => /^[a-z0-9-]+\.md$/.test(f) && f !== 'README.md') : [];
  const row = (f) => f.state === 'open'
    ? `<li class="src src-not" id="${esc(f.id)}"><h4>${esc(f.id)}: ${esc(f.title)} <span class="flag no">${esc(f.severity)}</span> <span class="flag">open</span></h4><p class="small">Details withheld until it is fixed, then published in full.</p></li>`
    : `<li class="src src-read" id="${esc(f.id)}"><h4>${esc(f.id)}: ${esc(f.title)} <span class="flag ${f.severity === 'high' ? 'no' : ''}">${esc(f.severity)}</span> <span class="flag ok">${esc(f.state)}</span></h4>
<dl class="ev-facts"><dt>Where</dt><dd>${esc(f.file || '')}</dd><dt>Found</dt><dd>${esc(f.found || '')}, by ${esc(f.found_by || '')}</dd><dt>What</dt><dd>${esc(f.detail || '')}</dd><dt>Fix</dt><dd>${esc(f.fix || '')}${f.commit && /^[0-9a-f]{7,40}$/.test(f.commit) ? ` (${link(`${REPO}/commit/${f.commit}`, f.commit)})` : ''}</dd></dl></li>`;
  const open = list.filter((f) => f.state === 'open').length;
  page({
    path: '/security/', section: '/security/', title: 'Security: every finding, published · PrompTugal.news Events',
    description: `Every vulnerability, bug and breach found on events.promptugal.news: ${list.length} so far, ${open} open. Fixed ones in full; open ones by title, severity and state until fixed.`,
    body: `<h1>Security</h1>
<p class="standfirst">Every vulnerability, bug and breach we find on this site is published here: what it was, how serious, where, when and how we found it, and the fix. An open one shows only its title, severity and state until it is fixed, then everything.</p>
${TELL_US.replace('If a source here is wrong', 'If you find a security problem').replace('if you run one of these sources and want it read, shown differently or not at all, or if you think we have its terms wrong, ', '')}
<p>${list.length} findings so far, ${open} open. The log of every PrompTugal site: <a href="https://promptugal.news/security/">promptugal.news/security/</a>. As data: <a href="${REPO}/blob/dev/data/security/findings.json">data/security/findings.json</a>.</p>
<section id="findings"><h2>Findings</h2><ul class="srcs">${sorted.map(row).join('\n')}</ul></section>
<section id="threat-models"><h2>Threat models</h2>
${tm.length ? `<ul>${tm.map((f) => `<li>${link(`${REPO}/blob/dev/docs/threat-models/${f}`, f.replace(/\.md$/, ''))}</li>`).join('')}</ul>` : '<p class="none">Being written: the data sync, the scheduled rebuild, the live data in the browser, and the issue forms as an input channel. Each will say what it reads, writes and trusts, what could go wrong, and how we guard against it.</p>'}</section>
<section id="how"><h2>How we look</h2><p>Every change to this site's code gets a security review before it is committed (an AppSec pass by a sub-agent, then security@PrompTugal.dinis across every PrompTugal repository, hourly). Everything from the data API, the agendas, Perplexity, the issue forms and messages is treated as untrusted: escaped before it reaches a page, and never followed as an instruction.</p></section>`,
    md: `${list.length} findings, ${open} open. Central log: https://promptugal.news/security/\n\n${sorted.map((f) => f.state === 'open' ? `- ${mdText(f.id)} (${mdText(f.severity)}, open): ${mdText(f.title)}` : `- ${mdText(f.id)} (${mdText(f.severity)}, ${mdText(f.state)}): ${mdText(f.title)}. ${mdText(f.detail || '')} Fix: ${mdText(f.fix || '')} (${mdText(f.commit || '')})`).join('\n')}`,
  });
}

// ---------------------------------------------------------------- /preview.svg: this site's live numbers, for the sites bar
// (Dinis, 18 Nov 2026 ~22:00 UTC, Website board/guidance/2026-11-18-the-sites-bar.md). Built from the same data as the pages.
{
  const week = addDays(today, 7);
  const all = [...itemsFor(REGION), ...itemsFor('lisboa'), ...beyondIds.flatMap((p) => itemsFor(p))];
  const thisWeek = all.filter((it) => startOf(it) >= today && startOf(it) < week).length;
  const withRead = placeIds.filter((p) => stats[p].read).map(nameOf);
  const reg = readJson('data/api/sources/index.json', { entries: [] });
  const regList = Array.isArray(reg.entries) ? reg.entries : [];
  const nRead = regList.filter((e) => e && e.status === 'read').length, nNot = regList.length - nRead;
  const x = (s) => esc(s); // every value escaped, as on the pages
  const fig = (cx, n, label1, label2) => `<g transform="translate(${cx},300)"><text class="n" text-anchor="middle">${x(String(n))}</text><text class="l" y="56" text-anchor="middle">${x(label1)}</text><text class="l" y="86" text-anchor="middle">${x(label2)}</text></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="t d">
<title id="t">PrompTugal.news Events: what's on, town by town</title>
<desc id="d">${x(`${totalRead} events read from official agendas and ${totalFound} found through Perplexity, across ${placeIds.length} places; ${thisWeek} starting in the next seven days. Data read ${fmtStamp(dataReadAt)}.`)}</desc>
<style>text{font-family:Georgia,'Times New Roman',serif;fill:#121317}.n{font-size:96px;font-weight:600}.l{font-family:Arial,sans-serif;font-size:24px;fill:#444}.s{font-family:Arial,sans-serif;font-size:19px;fill:#555}.b{font-size:54px;font-weight:600}.r{fill:#c52830}.g{fill:#006600}</style>
<rect width="1200" height="630" fill="#f6f3ec"/>
<rect x="0" y="0" width="1200" height="10" fill="#c52830"/>
<text x="60" y="100" class="b">Promp<tspan class="r">T</tspan><tspan class="g">ugal</tspan>.<tspan font-style="italic" font-weight="400">news</tspan><tspan class="l" dx="16" font-size="34">· Events</tspan></text>
<text x="60" y="150" class="l">What's on in the Algarve and Lisbon, town by town</text>
<line x1="60" y1="185" x2="1140" y2="185" stroke="#121317" stroke-width="3"/>
${fig(210, totalRead, 'events read from', 'official agendas')}
${fig(510, totalFound, 'found through', 'Perplexity')}
${fig(810, thisWeek, 'starting in the', 'next seven days')}
${fig(1060, placeIds.length, 'places', 'covered')}
<text x="60" y="490" class="s">${x(`Agendas read today: ${withRead.join(', ') || 'none'}. Sources on the register: ${nRead} read, ${nNot} not read, each with why.`)}</text>
<text x="60" y="540" class="s">${x(`Data from data.promptugal.news, read ${fmtStamp(dataReadAt)}; drawn by code for events.b@PrompTugal.dinis.`)}</text>
<text x="60" y="575" class="s">${x(`Licence: CC BY 4.0 (PrompTugal.news). events.promptugal.news${version === 'dev' ? '' : ` · version ${version}`}`)}</text>
</svg>
`;
  writeFileSync('_site/preview-card.svg', svg); // the 1200x630 social card (rendered to /preview.png at each wake)
  // /preview.svg for the sites bar's pop-up: 320x180, designer@'s template (design/sites-bar/preview-template.svg.txt), every value escaped
  const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img" aria-label="${x(`Events: ${totalRead + totalFound} events listed, ${thisWeek} this week, ${placeIds.length} places`)}">
  <rect width="320" height="180" rx="6" fill="#f6f3ec"/>
  <rect x="0" y="0" width="320" height="4" fill="#b5179e"/>
  <text x="16" y="30" font-family="IBM Plex Mono, monospace" font-size="10.5" letter-spacing="1.2" fill="#666860">EVENTS · NOW</text>
  <text x="16" y="84" font-family="Newsreader, Georgia, serif" font-size="46" fill="#121317">${x(String(totalRead + totalFound))}</text>
  <text x="16" y="104" font-family="IBM Plex Sans, Arial, sans-serif" font-size="12" fill="#3a3b40">events listed</text>
  <text x="176" y="72" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${x(String(thisWeek))}</text>
  <text x="176" y="88" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">starting this week</text>
  <text x="176" y="120" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${x(String(placeIds.length))}</text>
  <text x="176" y="136" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">places</text>
  <line x1="16" y1="150" x2="304" y2="150" stroke="#d8d4cb"/>
  <text x="16" y="168" font-family="IBM Plex Mono, monospace" font-size="10" fill="#666860">${x(`read ${fmtStamp(dataReadAt)} · CC BY 4.0`)}</text>
</svg>
`;
  writeFileSync('_site/preview.svg', small);
}

// ---------------------------------------------------------------- 404, llms.txt, version stamp, version.json
page({ path: '/404/', section: '', title: 'Not found · PrompTugal.news Events', description: 'This page does not exist on PrompTugal.news Events.', body: `<h1>Not found</h1><p>No page here. Try <a href="/places/">the places</a>.</p>`, md: 'No page here.' });
cpSync('_site/404/index.html', '_site/404.html');

writeFileSync('_site/llms.txt', `# PrompTugal.news Events\n\n> Events across Portugal, town by town (the Algarve's places and Lisbon first), built from data.promptugal.news's API. Each event has its date, place, venue, organiser where known, evidence links and licence. Events found only through Perplexity show title, date, place and evidence, with details withheld. Our text and records: CC BY 4.0.\n\n## Pages\n\n${pages.filter((p) => p.path !== '/404/').map((p) => `- [${p.title}](${SITE}${p.path}index.md): ${p.description}`).join('\n')}\n\n## Data\n\n- [Events by place](${DATA}/api/v1/events/by-place/index.json)\n- [Claims by place](${DATA}/api/v1/events/claims/by-place/index.json)\n- [Source](${REPO})\n`);

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('_site')) {
  if (!/\.(html|js|css|json|md|txt)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('__VERSION__')) writeFileSync(f, s.replaceAll('__VERSION__', version));
}
writeFileSync('_site/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || 'local', built: builtAt.toISOString(), data_read_at: dataReadAt || null }, null, 2) + '\n');
writeFileSync('_site/.nojekyll', '');
console.log(`built _site/ (${version}): ${pages.length} pages, ${totalRead} events read, ${totalFound} found through Perplexity, today ${today}`);
