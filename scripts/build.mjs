// Build: copy src/ to _site/, make the pages from data/api/ (the copy of data.promptugal.news that
// scripts/sync-data.mjs keeps), stamp the version, write version.json, a markdown twin for every page and llms.txt.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev". Node 18+, no dependencies.
// Template build by factory@AgentiCCells.dinis; the pages by events.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const version = process.env.SITE_VERSION || 'dev';
const SITE = 'https://events.promptugal.news';
const DATA = 'https://data.promptugal.news';
const REPO = 'https://github.com/PrompTugal/PrompTugal__News__Events';
const CCBY = 'https://creativecommons.org/licenses/by/4.0/';
const builtAt = new Date();

rmSync('_site', { recursive: true, force: true });
cpSync('src', '_site', { recursive: true });

// ---------------------------------------------------------------- data
const readJson = (f, fallback = null) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return fallback; } };
const index = readJson('data/api/index.json', { places: [] });
const claimsIndex = readJson('data/api/claims-index.json', { places: [] });
const eventsPt = readJson('data/api/events-pt.json', {});
const sync = readJson('data/api/sync.json', {});

const NAMES = {
  albufeira: 'Albufeira', alcoutim: 'Alcoutim', algarve: 'The Algarve', aljezur: 'Aljezur', 'castro-marim': 'Castro Marim',
  faro: 'Faro', lagoa: 'Lagoa', lagos: 'Lagos', lisboa: 'Lisboa', loule: 'Loulé', monchique: 'Monchique', olhao: 'Olhão',
  portimao: 'Portimão', quarteira: 'Quarteira', 'sao-bras-de-alportel': 'São Brás de Alportel', silves: 'Silves',
  tavira: 'Tavira', 'vila-do-bispo': 'Vila do Bispo', 'vila-real-de-santo-antonio': 'Vila Real de Santo António',
};
const nameOf = (id) => NAMES[id] || id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const REGION = 'algarve';
const placeIds = [...new Set([...index.places.map((p) => p.id), ...claimsIndex.places.map((p) => p.place)])]
  .filter((p) => /^[a-z0-9-]+$/.test(p) && p !== REGION)
  .sort((a, b) => (a === 'lisboa') - (b === 'lisboa') || nameOf(a).localeCompare(nameOf(b), 'pt'));
const algarveIds = placeIds.filter((p) => p !== 'lisboa');

const feeds = {};
for (const p of [...placeIds, REGION]) {
  const read = readJson(`data/api/by-place/${p}.json`, null);
  const claims = readJson(`data/api/claims/${p}.json`, null);
  feeds[p] = { read, claims };
}

// Lisbon's calendar day, for "today": the site is about Portugal.
const lisbonDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = lisbonDay(builtAt);

// House style: no em dashes in what we print (the gate). A source's em dash is shown as an en dash; the JSON keeps the original.
const clean = (s) => String(s ?? '').replace(/—/g, '–').replace(/\s+/g, ' ').trim();
const esc = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escUrl = (u) => String(u ?? '').replace(/&/g, '&amp;').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
const okUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const link = (u, text) => (okUrl(u) ? `<a href="${escUrl(u)}">${esc(text)}</a>` : esc(text));
const mdText = (s) => clean(s).replace(/([\[\]*_`<>|])/g, '\\$1');
const mdLink = (u, text) => (okUrl(u) ? `[${mdText(text)}](${String(u).replace(/ /g, '%20').replace(/\)/g, '%29')})` : mdText(text));
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayPart = (s) => String(s || '').slice(0, 10);
const timePart = (s) => (/T(\d{2}:\d{2})/.exec(String(s || '')) || [])[1] || '';
const ymd = (s) => { const [y, m, d] = dayPart(s).split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const fmtDay = (s, withYear = true) => { const t = ymd(s); return `${DAYS[t.dow]} ${t.d} ${MONTHS[t.m - 1]}${withYear ? ` ${t.y}` : ''}`; };
const fmtWhen = (start, end) => {
  const t = timePart(start);
  if (!end || dayPart(end) === dayPart(start)) return `${fmtDay(start)}${t ? `, ${t}` : ''}`;
  return `${fmtDay(start, ymd(start).y !== ymd(end).y)} to ${fmtDay(end)}${t ? ` (from ${t})` : ''}`;
};
const fmtStamp = (iso) => {
  if (!iso) return 'unknown';
  const d = new Date(iso); if (isNaN(d)) return esc(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
};
const addDays = (day, n) => { const t = ymd(day); return new Date(Date.UTC(t.y, t.m - 1, t.d + n)).toISOString().slice(0, 10); };

// One shape for both kinds: "read" (details from a source we may read) and "found" (a claim found through Perplexity).
function readItems(place) {
  const f = feeds[place]?.read; if (!f) return [];
  return (f.events || []).filter((e) => e && e.name && e.startDate).map((e) => ({ kind: 'read', place: e.place || place, e }));
}
function foundItems(place) {
  const f = feeds[place]?.claims; if (!f) return [];
  return (f.claims || []).filter((c) => c && c.name && c.startDate).map((c) => ({ kind: 'found', place: c.place || place, e: c, discovery: f.discovery }));
}
function itemsFor(place) {
  if (place === REGION) {
    const read = readItems(REGION);
    const found = algarveIds.flatMap(foundItems);
    return [...read, ...found];
  }
  return [...readItems(place), ...foundItems(place)];
}
const endOf = (it) => dayPart(it.e.endDate || it.e.startDate);
const startOf = (it) => dayPart(it.e.startDate);
const isCurrent = (it) => endOf(it) >= today;
function groupByDay(items) {
  const now = [], days = new Map();
  for (const it of items.filter(isCurrent)) {
    if (startOf(it) < today) now.push(it);
    else { const k = startOf(it); if (!days.has(k)) days.set(k, []); days.get(k).push(it); }
  }
  const order = (a, b) => (a.kind === b.kind ? 0 : a.kind === 'read' ? -1 : 1) || (timePart(a.e.startDate) || '99').localeCompare(timePart(b.e.startDate) || '99') || clean(a.e.name).localeCompare(clean(b.e.name), 'pt');
  now.sort((a, b) => endOf(a).localeCompare(endOf(b)) || order(a, b));
  const sorted = [...days.keys()].sort().map((k) => [k, days.get(k).sort(order)]);
  return { now, days: sorted };
}

// ---------------------------------------------------------------- one event, as HTML and as markdown
const PUBLISHER_FALLBACK = (e) => e.license?.holder || host(e.url) || 'the source';
function licenceHtml(l) {
  if (!l) return `<a class="lic" href="${CCBY}">CC BY 4.0</a> (our record)`;
  const name = l.name === "the source's terms" ? `the source's terms${l.holder ? ` (${l.holder})` : ''}` : `${l.name}${l.holder && l.holder !== 'PrompTugal.news' ? ` (${l.holder})` : ''}`;
  return link(l.url, name).replace('<a ', '<a class="lic" ');
}
function licenceMd(l) {
  if (!l) return `${mdLink(CCBY, 'CC BY 4.0')} (our record)`;
  const name = l.name === "the source's terms" ? `the source's terms${l.holder ? ` (${l.holder})` : ''}` : l.name;
  return mdLink(l.url, name);
}
function sourceLabel(e) { return clean(String(e.source || '').replace(/^https?:\/\/\S+\s*/, '').replace(/^\(|\)$/g, '')) || host(e.url); }
function sourceUrl(e) { return (/^(https?:\/\/\S+)/.exec(String(e.source || '')) || [])[1] || ''; }

function eventHtml(it, { showPlace = false } = {}) {
  const e = it.e;
  const place = nameOf(it.place);
  if (it.kind === 'read') {
    const venue = e.location?.name ? esc(e.location.name) : '<span class="none">not given by the source</span>';
    const org = e.organizer?.name ? esc(e.organizer.name) : `<span class="none">not named by the source; listed by ${esc(PUBLISHER_FALLBACK(e))}</span>`;
    return `<li class="ev ev-read">
<h4 class="ev-name">${link(e.url, e.name)}</h4>
<dl class="ev-facts"><dt>When</dt><dd>${esc(fmtWhen(e.startDate, e.endDate))}</dd>${showPlace ? `<dt>Place</dt><dd><a href="/places/${it.place}/">${esc(place)}</a></dd>` : `<dt>Place</dt><dd>${esc(place)}</dd>`}<dt>Venue</dt><dd>${venue}</dd><dt>Organiser</dt><dd>${org}</dd>
<dt>Evidence</dt><dd>${link(e.url, `the event's page on ${host(e.url) || 'the source'}`)}${sourceUrl(e) ? `; ${link(sourceUrl(e), sourceLabel(e) || 'the list it was read from')}` : ''}; read ${esc(fmtStamp(e.read_at))}</dd>
<dt>Licence</dt><dd>${licenceHtml(e.license)}</dd></dl>
</li>`;
  }
  const ev = (e.evidence || []).filter((x) => okUrl(x.url));
  const evHtml = ev.map((x) => `${link(x.url, x.host || host(x.url))} <span class="flag ${x.readable ? 'ok' : 'no'}">${x.readable ? 'we may read it' : 'we do not copy it'}</span>`).join('; ') || '<span class="none">none kept</span>';
  const df = e.details_from;
  const confirm = e.status === 'confirmed'
    ? `<p class="withheld">Confirmed at a source we may read${df ? `: ${okUrl(df) ? link(df, host(df)) : esc(typeof df === 'string' ? df : df.url || df.name || '')}` : ''}.</p>`
    : e.status === 'details withheld'
    ? `<p class="withheld">Details withheld: the source's terms do not let us copy them. <a href="/organisers/">Organisers, send them to us.</a></p>`
    : `<p class="withheld">${esc(e.status === 'to confirm at a readable source' ? 'To confirm: a source we may read is cited, and its details are not read yet.' : (e.details_note || e.status || ''))} <a href="/organisers/">Organisers, send us the details.</a></p>`;
  const d = it.discovery;
  return `<li class="ev ev-found">
<p class="badge">Found through Perplexity</p>
<h4 class="ev-name">${esc(e.name)}</h4>
<dl class="ev-facts"><dt>When</dt><dd>${esc(fmtWhen(e.startDate, e.endDate))}</dd><dt>Place</dt><dd>${showPlace ? `<a href="/places/${it.place}/">${esc(place)}</a>` : esc(place)}</dd>
<dt>Evidence</dt><dd>${evHtml}</dd>
<dt>Found</dt><dd>through Perplexity${d ? ` (${esc(d.model || 'sonar')}, via ${esc(d.via || 'OpenRouter')}, asked ${esc(fmtStamp(d.asked_at))})` : ''}, by <a href="${DATA}/">data.promptugal.news</a></dd>
<dt>Licence</dt><dd>${licenceHtml(e.license)}; each evidence link is under its own source's terms</dd></dl>
${confirm}
</li>`;
}
function eventMd(it) {
  const e = it.e, place = nameOf(it.place);
  if (it.kind === 'read') {
    return [`- **${mdLink(e.url, e.name)}**`, `  - When: ${mdText(fmtWhen(e.startDate, e.endDate))}; place: ${mdText(place)}; venue: ${mdText(e.location?.name || 'not given by the source')}`,
      `  - Organiser: ${mdText(e.organizer?.name || `not named by the source; listed by ${PUBLISHER_FALLBACK(e)}`)}`,
      `  - Evidence: ${mdLink(e.url, "the event's page")}${sourceUrl(e) ? `; ${mdLink(sourceUrl(e), sourceLabel(e) || 'the list it was read from')}` : ''}; read ${fmtStamp(e.read_at)}`,
      `  - Licence: ${licenceMd(e.license)}`].join('\n');
  }
  const ev = (e.evidence || []).filter((x) => okUrl(x.url)).map((x) => `${mdLink(x.url, x.host || host(x.url))} (${x.readable ? 'we may read it' : 'we do not copy it'})`).join('; ');
  return [`- **${mdText(e.name)}** (found through Perplexity)`, `  - When: ${mdText(fmtWhen(e.startDate, e.endDate))}; place: ${mdText(place)}`,
    `  - Evidence: ${ev || 'none kept'}`, `  - ${e.status === 'confirmed' ? 'Confirmed at a source we may read.' : e.status === 'details withheld' ? "Details withheld: the source's terms do not let us copy them. Organisers, send them to us: " + SITE + '/organisers/' : 'To confirm at a source we may read.'}`,
    `  - Licence: ${licenceMd(e.license)}; each evidence link under its own source's terms`].join('\n');
}

function listHtml(items, opts = {}) {
  const { now, days } = groupByDay(items);
  const out = [];
  if (now.length) out.push(`<section class="day" id="on-now"><h3>On now <span class="n">${now.length}</span></h3><p class="small">Started before today and still running, ending soonest first.</p><ul class="evs">${now.map((it) => eventHtml(it, opts)).join('\n')}</ul></section>`);
  for (const [day, list] of days) out.push(`<section class="day" id="d-${day}"><h3>${esc(fmtDay(day))}${day === today ? ' (today)' : ''} <span class="n">${list.length}</span></h3><ul class="evs">${list.map((it) => eventHtml(it, opts)).join('\n')}</ul></section>`);
  return { html: out.join('\n'), count: now.length + days.reduce((n, [, l]) => n + l.length, 0) };
}
function listMd(items) {
  const { now, days } = groupByDay(items);
  const out = [];
  if (now.length) out.push(`### On now\n\n${now.map(eventMd).join('\n')}`);
  for (const [day, list] of days) out.push(`### ${fmtDay(day)}\n\n${list.map(eventMd).join('\n')}`);
  return out.join('\n\n');
}

// ---------------------------------------------------------------- the page frame
const SITES = [['Events', 'https://events.promptugal.news/'], ['Weather', 'https://weather.promptugal.news/'], ['Civic', 'https://civic.promptugal.news/'], ['Startups', 'https://startups.promptugal.news/'], ['Travel', 'https://travel.promptugal.news/'], ['Data', 'https://data.promptugal.news/']];
const NAV = [['/', 'Events'], ['/places/', 'Places'], ['/organisers/', 'Organisers'], ['/how/', 'How it works']];
const pages = []; // [{path, title, md}]

function page({ path, title, description, section, body, md }) {
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" type="text/markdown" href="${path}index.md">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css?v=${esc(version)}">
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<div class="version-bar"><span>Version ${esc(version)}</span><span><a href="${path}index.md">This page as markdown</a></span></div>
<header class="masthead">
  <div class="masthead-row">
    <a class="brand" href="/" aria-label="PrompTugal.news Events, home"><span class="wm">Promp<span class="t">T</span><span class="g">ugal</span>.<i>news</i></span><span class="sub">· Events</span></a>
    <a class="tool meter" href="https://promptugal.news/account/" title="The events pages are free: what they list comes from sources whose terms allow reference use only, so nothing here is charged until Dinis decides. Your PrompTugal.news balance is kept on promptugal.news."><span class="meter-label">Pay for what you read · </span><b>free here</b></a>
  </div>
  <nav class="nav" aria-label="Sections">${NAV.map(([h, t]) => `<a href="${h}"${h === section ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
</header>
<nav class="em-net" aria-label="The PrompTugal.news sites"><span>Also from <a href="https://promptugal.news/">PrompTugal.news</a></span>${SITES.map(([t, u]) => `<a href="${u}"${t === 'Events' ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
<main id="main">
${body}
</main>
<footer class="footer">
  <p>Part of <a href="https://promptugal.news/">PrompTugal.news</a>: Portugal, town by town. Independent: not an official or government site, and not a ticketing or booking service: check with the organiser before you travel.</p>
  <p class="licences">Licences: our pages, words and records <a class="lic" href="${CCBY}">CC BY 4.0</a>; each event read from a source stays under that source's licence or terms, linked on the event. Data from <a href="${DATA}/">data.promptugal.news</a> (<a href="${DATA}/sources/">what it reads</a>, <a href="${DATA}/sources/not-read/">what it does not, and why</a>).</p>
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
  const algItems = [...readItems(REGION), ...algarveIds.flatMap(foundItems), ...readItems('lisboa'), ...foundItems('lisboa')]
    .filter((it) => startOf(it) >= today && startOf(it) < week);
  const wk = listHtml(algItems, { showPlace: true });
  const placeRows = [REGION, ...placeIds].map((p) => `<li><a href="/places/${p}/">${esc(nameOf(p))}</a>${p === REGION ? ' <span class="small">(every Algarve place together)</span>' : ''} <span class="small">${counts(p)}</span></li>`).join('\n');
  page({
    path: '/', section: '/', title: "PrompTugal.news Events: what's on, town by town",
    description: `Events across Portugal, town by town: ${totalRead} read from official agendas and ${totalFound} found through Perplexity, for the Algarve's places and Lisbon, each with its evidence and licence.`,
    body: `<section class="hero">
<p class="kicker">Events · Portugal, town by town</p>
<h1>What's on in the Algarve and Lisbon</h1>
<p class="standfirst">${totalRead} events read from official agendas and ${totalFound} more found through Perplexity, across ${placeIds.length} places. Every event shows its date, place, venue and organiser where a source we may read gives them, the evidence for it, and its licence.</p>
${fresh}
<p class="note">Two kinds of listing: <b>read</b> events come from a public agenda we may read (the agendas data.promptugal.news reads: ${esc(sourcesRead.join(' and ') || 'none yet')}), with the details it gives; events <b>found through Perplexity</b> show only their title, date, place and the links that point to them, because the sites those links lead to do not let us copy their details. <a href="/organisers/">Organisers: send us yours.</a></p>
</section>
<section><h2>Places</h2><ul class="places">${placeRows}</ul>${lisbonNote ? `<p class="small">${lisbonNote}</p>` : ''}</section>
<section><h2>Starting in the next seven days</h2>${wk.count ? wk.html : '<p class="none">Nothing listed yet for the next seven days.</p>'}<p class="small">Long-running exhibitions and events already on are on each place's page, under "On now".</p></section>`,
    md: `${totalRead} events read from official agendas and ${totalFound} found through Perplexity, across ${placeIds.length} places. Data read ${fmtStamp(dataReadAt)}.\n\n## Places\n\n${[REGION, ...placeIds].map((p) => `- ${mdLink(`${SITE}/places/${p}/`, nameOf(p))}: ${counts(p).replace(/<[^>]+>/g, '')}`).join('\n')}\n\n## Starting in the next seven days\n\n${listMd(algItems) || 'Nothing listed yet.'}`,
  });
}

// ---------------------------------------------------------------- places index and one page per place
page({
  path: '/places/', section: '/places/', title: 'Places: PrompTugal.news Events',
  description: "Every place the events site covers: the Algarve's towns and Lisbon, with how many events each lists.",
  body: `<h1>Places</h1><p class="standfirst">The Algarve's places and Lisbon first; more as data.promptugal.news reads more agendas.</p>${fresh}
<table class="places-table"><thead><tr><th scope="col">Place</th><th scope="col">Read from an agenda</th><th scope="col">Found through Perplexity</th></tr></thead><tbody>
${[REGION, ...placeIds].map((p) => `<tr><th scope="row"><a href="/places/${p}/">${esc(nameOf(p))}</a></th><td class="n">${stats[p].read}</td><td class="n">${stats[p].found}</td></tr>`).join('\n')}
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
<p class="standfirst">${stats[p].read} events read from official agendas${stats[p].found ? ` and ${stats[p].found} found through Perplexity` : ''}, on now or starting within about 60 days, by day.</p>
${fresh}
${read?.source_note && stats[p].read ? `<details class="small"><summary>The sources and their terms</summary><p>${esc(read.source_note)}</p></details>` : ''}
${L.count ? L.html : `<p class="none">${empty}</p>`}
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
<p>For now, open an issue on this site's public repository, <a href="${REPO}/issues">github.com/PrompTugal/PrompTugal__News__Events</a>, titled with your event's name, from an account that is your organisation's or that your organisation's site names. A form and an email address are coming; until then this is the one public channel we have, and anything you post there is public.</p>
<p class="small">This page is a first version, and the channel is a proposal: written by events.b@PrompTugal.dinis (an AI agent) from Dinis Cruz's rule of 18 November 2026 ("When he sends his own details, we publish them, credited ... eventually we want to have PKI here").</p></section>`,
  md: `If your event is listed with "details withheld", send its details yourself and we publish them, credited to you and dated.\n\n- Published as yours, credited and dated, with a link to your page.\n- Under the licence you choose (we suggest CC BY 4.0).\n- Signed later (PKI), added as we go.\n- Only from the organiser; a third party's details are a lead to check (a proposal for Dinis Cruz).\n\nSend: name; start and end; town and venue; your organisation and website; the event's link; an optional short description; the licence. Where: an issue on ${REPO}/issues (public), until a form and an email address exist.`,
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
<p>The whole register: <a href="${DATA}/sources/">every source data.promptugal.news reads</a>, <a href="${DATA}/sources/not-read/">every one it does not, and why</a>, quoting the terms or robots.txt with the date read. We respect what each says. Eventbrite, Luma (lu.ma, luma.com) and Meetup are never read by machine, at Dinis Cruz's word, until he decides otherwise; their listings can appear here only as evidence links.</p></section>
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
<section><h2>The graph</h2>
<p>Each event will link to its <b>place</b>, its <b>venue</b>, its <b>organiser</b> (an organisation), its <b>past editions</b> (an event series: an event is never deleted when it ends, it moves to the series' history), and the <b>companies</b> and public, professional <b>people</b> connected to it. ontologist@ and data.b@ define the graph on data.promptugal.news (<code>/api/v1/graph/</code>, not published yet); this site will show it when it is.</p>
<p class="small">Today the records give place and venue; the organiser is named only where the agenda names one; past editions and companies are not linked yet.</p></section>`,
    md: `This site runs no collector. Everything comes from ${DATA}/ (data.promptugal.news), which reads public agendas it may read and asks Perplexity once a day per place what is on, keeping every cited link as evidence.\n\n- Read events: details from sources we may read (${sourcesRead.join('; ')}).\n- Found through Perplexity: title, date, place and evidence links only; details withheld.\n- Licences: ours CC BY 4.0; each event under its source's terms.\n- Register: ${DATA}/sources/ and ${DATA}/sources/not-read/; gaps: ${DATA}/sources/gaps/\n- The graph (event, venue, organiser, past editions, places, companies): defined by ontologist@ and data.b@, not published yet.`,
  });
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
