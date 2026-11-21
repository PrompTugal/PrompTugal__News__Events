// The shared renderer: one event card and the day-by-day list, used by scripts/build.mjs (the built pages)
// and by assets/live.js in the browser (the same pages refreshed from data.promptugal.news's API).
// No dependencies; runs in Node 18+ and in browsers. events.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
export const SITE = 'https://events.promptugal.news';
export const DATA = 'https://data.promptugal.news';
export const CCBY = 'https://creativecommons.org/licenses/by/4.0/';
export const REGION = 'algarve';
export const NAMES = {
  albufeira: 'Albufeira', alcoutim: 'Alcoutim', algarve: 'The Algarve', aljezur: 'Aljezur', 'castro-marim': 'Castro Marim',
  faro: 'Faro', lagoa: 'Lagoa', lagos: 'Lagos', lisboa: 'Lisboa', loule: 'Loulé', monchique: 'Monchique', olhao: 'Olhão',
  portimao: 'Portimão', quarteira: 'Quarteira', 'sao-bras-de-alportel': 'São Brás de Alportel', silves: 'Silves',
  tavira: 'Tavira', 'vila-do-bispo': 'Vila do Bispo', 'vila-real-de-santo-antonio': 'Vila Real de Santo António', london: 'London',
};
export const nameOf = (id) => NAMES[id] || String(id || '').split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
// Every value from the API is untrusted (AppSec review, 18 Nov 2026): ids and dates are checked before use in a link, an id or a heading.
export const okId = (p) => typeof p === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p);
export const okDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(d);
export const lisbonDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export let today = lisbonDay(new Date());
export const setToday = (d) => { today = d; };

// House style: no em dashes in what we print (the gate). A source's em dash is shown as an en dash; the JSON keeps the original.
export const clean = (s) => String(s ?? '').replace(/—/g, '–').replace(/\s+/g, ' ').trim();
export const esc = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escUrl = (u) => String(u ?? '').replace(/&/g, '&amp;').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
export const okUrl = (u) => typeof u === 'string' && /^https?:\/\/[^\s<>"'`\\]+$/i.test(u);
export const link = (u, text) => (okUrl(u) ? `<a href="${escUrl(u)}">${esc(text)}</a>` : esc(text));
export const mdText = (s) => clean(s).replace(/([\[\]*_`<>|])/g, '\\$1');
export const mdLink = (u, text) => (okUrl(u) ? `[${mdText(text)}](${String(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/</g, '%3C').replace(/>/g, '%3E')})` : mdText(text));
export const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayPart = (s) => String(s || '').slice(0, 10);
export const timePart = (s) => (/T(\d{2}:\d{2})/.exec(String(s || '')) || [])[1] || '';
export const ymd = (s) => { const [y, m, d] = dayPart(s).split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
export const fmtDay = (s, withYear = true) => { const t = ymd(s); return `${DAYS[t.dow]} ${t.d} ${MONTHS[t.m - 1]}${withYear ? ` ${t.y}` : ''}`; };
export const fmtWhen = (start, end) => {
  const t = timePart(start);
  if (!end || dayPart(end) === dayPart(start)) return `${fmtDay(start)}${t ? `, ${t}` : ''}`;
  return `${fmtDay(start, ymd(start).y !== ymd(end).y)} to ${fmtDay(end)}${t ? ` (from ${t})` : ''}`;
};
export const fmtStamp = (iso) => {
  if (!iso) return 'unknown';
  const d = new Date(iso); if (isNaN(d)) return '(time not given)';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
};
export const addDays = (day, n) => { const t = ymd(day); return new Date(Date.UTC(t.y, t.m - 1, t.d + n)).toISOString().slice(0, 10); };

// One shape for both kinds: "read" (details from a source we may read) and "found" (a claim found through Perplexity).
const okItem = (e) => e && typeof e === 'object' && typeof e.name === 'string' && e.name.trim() && okDate(e.startDate) && (e.endDate == null || e.endDate === '' || okDate(e.endDate));
const pid = (p, fallback) => (okId(p) ? p : okId(fallback) ? fallback : 'algarve');
const arr = (a) => (Array.isArray(a) ? a : []);
export const readItemsOf = (f, place) => arr(f?.events).filter(okItem).map((e) => ({ kind: 'read', place: pid(e.place, place), e, by: typeof f?.by === 'string' ? f.by : '' }));
// Provenance on every item (Dinis, 18 Nov 2026 ~19:00 UTC): how it was read, by what, and who shows it here.
const SHOWN = 'shown here by events.b@PrompTugal.dinis (an AI agent)';
const readHow = (it) => `read by ${it.by ? clean(it.by).slice(0, 200) : 'a collector not stated'}, on data.promptugal.news; ${SHOWN}`;
export const foundItemsOf = (f, place) => arr(f?.claims).filter(okItem).map((c) => ({ kind: 'found', place: pid(c.place, place), e: c, discovery: f.discovery && typeof f.discovery === 'object' ? f.discovery : null }));
export const endOf = (it) => dayPart(it.e.endDate || it.e.startDate);
export const startOf = (it) => dayPart(it.e.startDate);
export const isCurrent = (it) => endOf(it) >= today;
export function groupByDay(items) {
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
export const PUBLISHER_FALLBACK = (e) => e.license?.holder || host(e.url) || 'the source';
export function licenceHtml(l) {
  if (!l) return `<a class="lic" href="${CCBY}">CC BY 4.0</a> (our record)`;
  const name = l.name === "the source's terms" ? `the source's terms${l.holder ? ` (${l.holder})` : ''}` : `${l.name}${l.holder && l.holder !== 'PrompTugal.news' ? ` (${l.holder})` : ''}`;
  return link(l.url, name).replace('<a ', '<a class="lic" ');
}
export function licenceMd(l) {
  if (!l) return `${mdLink(CCBY, 'CC BY 4.0')} (our record)`;
  const name = l.name === "the source's terms" ? `the source's terms${l.holder ? ` (${l.holder})` : ''}` : l.name;
  return mdLink(l.url, name);
}
export function sourceLabel(e) { return clean(String(e.source || '').replace(/^https?:\/\/\S+\s*/, '').replace(/^\(|\)$/g, '')) || host(e.url); }
export function sourceUrl(e) { return (/^(https?:\/\/\S+)/.exec(String(e.source || '')) || [])[1] || ''; }

export function eventMd(it) {
  const e = it.e, place = nameOf(it.place);
  if (it.kind === 'read') {
    return [`- **${mdLink(e.url, e.name)}**`, `  - When: ${mdText(fmtWhen(e.startDate, e.endDate))}; place: ${mdText(place)}; venue: ${mdText(e.location?.name || 'not given by the source')}`,
      `  - Organiser: ${mdText(e.organizer?.name || `not named by the source; listed by ${PUBLISHER_FALLBACK(e)}`)}`,
      `  - Evidence: ${mdLink(e.url, "the event's page")}${sourceUrl(e) ? `; ${mdLink(sourceUrl(e), sourceLabel(e) || 'the list it was read from')}` : ''}; read ${fmtStamp(e.read_at)}`,
      `  - Licence: ${licenceMd(e.license)}`, `  - Provenance: ${mdText(readHow(it))}`].join('\n');
  }
  const ev = arr(e.evidence).filter((x) => x && okUrl(x.url)).map((x) => `${mdLink(x.url, x.host || host(x.url))} (${x.readable ? 'we may read it' : 'we do not copy it'})`).join('; ');
  return [`- **${mdText(e.name)}** (found through Perplexity)`, `  - When: ${mdText(fmtWhen(e.startDate, e.endDate))}; place: ${mdText(place)}`,
    `  - Evidence: ${ev || 'none kept'}`, `  - ${e.status === 'confirmed' ? 'Confirmed at a source we may read.' : e.status === 'details withheld' ? "Details withheld: the source's terms do not let us copy them. Organisers, send them to us: " + SITE + '/organisers/' : 'To confirm at a source we may read.'}`,
    `  - Licence: ${licenceMd(e.license)}; each evidence link under its own source's terms`, `  - Provenance: found through Perplexity${it.discovery ? ` (${mdText(it.discovery.model || 'sonar')}, asked ${fmtStamp(it.discovery.asked_at)})` : ''} by data.promptugal.news; ${SHOWN}`].join('\n');
}

export function listMd(items) {
  const { now, days } = groupByDay(items);
  const out = [];
  if (now.length) out.push(`### On now\n\n${now.map(eventMd).join('\n')}`);
  for (const [day, list] of days) out.push(`### ${fmtDay(day)}\n\n${list.map(eventMd).join('\n')}`);
  return out.join('\n\n');
}

// ---- One event as a tree of elements and text (Dinis, 19 Nov 2026 ~01:13 UTC: data in the browser, values by textContent).
// n(tag, attrs, ...kids): kids are strings (text) or nodes. toHtml escapes everything for the build; toDom builds DOM nodes
// with createElement and textContent for the browser. Links only from okUrl() or this site's own paths.
export const n = (t, a, ...k) => ({ t, a: a || {}, k: k.flat().filter((x) => x != null && x !== false && x !== '') });
// Links from the data: http(s) only. Links to this site's own pages: only the literal paths this code writes (P below).
const okHref = (u) => okUrl(u) || /^\/(?!\/)[a-z0-9/-]*$/.test(u);
const A = (u, text) => (okUrl(u) ? n('a', { href: u }, text) : text);
const P = (path, text) => n('a', { href: path }, text);
// Text fragments keep their outer spaces ("; ", " ("): the same cleaning as clean(), without the trim.
// Each loaded file's own licence, read from the file (security@'s ruling, 19 Nov 2026: licence and provenance travel with
// the loaded data). Plain text only; a name or holder that is not a short plain string is left out.
const okLicText = (s) => typeof s === 'string' && s.length > 0 && s.length <= 80 && /^[\p{L}\p{N} .,()'&+\/-]+$/u.test(s);
export function licenceOf(files) {
  const seen = [];
  for (const f of files || []) {
    const l = f && typeof f === 'object' ? f.license : null;
    if (!l || typeof l !== 'object' || !okLicText(l.name)) continue;
    const t = okLicText(l.holder) ? `${l.name} (${l.holder})` : l.name;
    if (!seen.includes(t)) seen.push(t);
  }
  return seen.length ? `The files' own licence: ${seen.join('; ')}.` : 'The files name no licence.';
}
const cleanKeep = (s) => String(s ?? '').replace(/\u2014/g, '\u2013').replace(/\s+/g, ' ');
const escText = (s) => cleanKeep(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function toHtml(x) {
  if (typeof x === 'string') return escText(x);
  const attrs = Object.entries(x.a).filter(([k, v]) => v != null && (k !== 'href' || okHref(v))).map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
  return `<${x.t}${attrs}>${x.k.map(toHtml).join('')}</${x.t}>`;
}
export function toDom(x, doc) {
  if (typeof x === 'string') return doc.createTextNode(cleanKeep(x));
  const el = doc.createElement(x.t);
  for (const [k, v] of Object.entries(x.a)) if (v != null && (k !== 'href' || okHref(v))) el.setAttribute(k, String(v));
  for (const c of x.k) el.appendChild(toDom(c, doc));
  return el;
}
const none = (s) => n('span', { class: 'none' }, s);
function licenceTree(l) {
  if (!l) return [n('a', { class: 'lic', href: CCBY }, 'CC BY 4.0'), ' (our record)'];
  const name = l.name === "the source's terms" ? `the source's terms${l.holder ? ` (${l.holder})` : ''}` : `${l.name}${l.holder && l.holder !== 'PrompTugal.news' ? ` (${l.holder})` : ''}`;
  return okUrl(l.url) ? [n('a', { class: 'lic', href: l.url }, name)] : [name];
}
const join = (parts, sep) => parts.flatMap((p, i) => (i ? [sep, ...[].concat(p)] : [].concat(p)));
export function eventTree(it, { showPlace = false } = {}) {
  const e = it.e, place = nameOf(it.place);
  const placeDd = showPlace && okId(it.place) ? P(`/places/${it.place}/`, place) : place;
  const report = n('p', { class: 'report' }, P('/report/', 'Something wrong? Tell us'));
  if (it.kind === 'read') {
    const ev = [A(e.url, `the event's page on ${host(e.url) || 'the source'}`)];
    if (sourceUrl(e)) ev.push('; ', A(sourceUrl(e), sourceLabel(e) || 'the list it was read from'));
    ev.push('; ', e.stale ? [n('b', null, `as read at ${fmtStamp(e.read_at)}`), ' (the source has not answered since; kept up to 48 hours)'] : `read ${fmtStamp(e.read_at)}`);
    return n('li', { class: 'ev ev-read' },
      n('h4', { class: 'ev-name' }, A(e.url, e.name)),
      n('dl', { class: 'ev-facts' },
        n('dt', null, 'When'), n('dd', null, fmtWhen(e.startDate, e.endDate)),
        n('dt', null, 'Place'), n('dd', null, placeDd),
        n('dt', null, 'Venue'), n('dd', null, e.location?.name ? e.location.name : none('not given by the source')),
        n('dt', null, 'Organiser'), n('dd', null, e.organizer?.name ? e.organizer.name : none(`not named by the source; listed by ${PUBLISHER_FALLBACK(e)}`)),
        n('dt', null, 'Evidence'), n('dd', null, ev),
        n('dt', null, 'Licence'), n('dd', null, licenceTree(e.license)),
        n('dt', null, 'Provenance'), n('dd', null, readHow(it), ' (', P('/how/', 'how it works'), ')')),
      report);
  }
  const evs = arr(e.evidence).filter((x) => x && okUrl(x.url)).map((x) => [A(x.url, x.host || host(x.url)), ' ', n('span', { class: `flag ${x.readable ? 'ok' : 'no'}` }, x.readable ? 'we may read it' : 'we do not copy it')]);
  const df = e.details_from, dfu = String(typeof df === 'string' ? df : (df && df.url) || '').split(' ')[0];
  const confirm = e.status === 'confirmed'
    ? n('p', { class: 'withheld' }, 'Confirmed at a source we may read', df ? [': ', okUrl(dfu) ? A(dfu, host(dfu)) : (typeof df === 'string' ? df : '')] : '', '.')
    : e.status === 'details withheld'
    ? n('p', { class: 'withheld' }, "Details withheld: the source's terms do not let us copy them. ", P('/organisers/', 'Organisers, send them to us.'))
    : n('p', { class: 'withheld' }, e.status === 'to confirm at a readable source' ? 'To confirm: a source we may read is cited, and its details are not read yet.' : (e.details_note || e.status || ''), ' ', P('/organisers/', 'Organisers, send us the details.'));
  const d = it.discovery;
  return n('li', { class: 'ev ev-found' },
    n('p', { class: 'badge' }, 'Found through Perplexity'),
    n('h4', { class: 'ev-name' }, e.name),
    n('dl', { class: 'ev-facts' },
      n('dt', null, 'When'), n('dd', null, fmtWhen(e.startDate, e.endDate)),
      n('dt', null, 'Place'), n('dd', null, placeDd),
      n('dt', null, 'Evidence'), n('dd', null, evs.length ? join(evs, '; ') : none('none kept')),
      n('dt', null, 'Found'), n('dd', null, `through Perplexity${d ? ` (${d.model || 'sonar'}, via ${d.via || 'OpenRouter'}, asked ${fmtStamp(d.asked_at)})` : ''}, by `, A(`${DATA}/`, 'data.promptugal.news'), `; ${SHOWN} (`, P('/how/', 'how it works'), ')'),
      n('dt', null, 'Licence'), n('dd', null, licenceTree(e.license), "; each evidence link is under its own source's terms")),
    confirm, report);
}
export function listTree(items, opts = {}) {
  const { now, days } = groupByDay(items);
  const out = [];
  if (now.length) out.push(n('section', { class: 'day', id: 'on-now' }, n('h3', null, 'On now ', n('span', { class: 'n' }, String(now.length))), n('p', { class: 'small' }, 'Started before today and still running, ending soonest first.'), n('ul', { class: 'evs' }, now.map((it) => eventTree(it, opts)))));
  for (const [day, list] of days) out.push(n('section', { class: 'day', id: `d-${day}` }, n('h3', null, `${fmtDay(day)}${day === today ? ' (today)' : ''} `, n('span', { class: 'n' }, String(list.length))), n('ul', { class: 'evs' }, list.map((it) => eventTree(it, opts)))));
  return { nodes: out, count: now.length + days.reduce((k, [, l]) => k + l.length, 0) };
}
export const eventHtml = (it, opts) => toHtml(eventTree(it, opts));
export function listHtml(items, opts = {}) { const L = listTree(items, opts); return { html: L.nodes.map(toHtml).join('\n'), count: L.count }; }

// ---- The past (Dinis, 19 Nov 2026 ~01:17 UTC, "show the past"), from data.b@'s events history: one renderer for the build
// and the browser. Each event as its source first listed it, every change seen since, last seen and gone; the claims kept.
// The same rules as the data gate (scripts/check-data.mjs): an item that fails them is dropped.
const okDn = (d) => d == null || d === '' || okDate(d);
export const okHistVal = (v) => v == null || (typeof v === 'string' && v.length <= 500) || (typeof v === 'number' && Number.isFinite(v));
export const okHistEvent = (e) => !!e && typeof e === 'object' && okUrl(e.url) && !!e.first && typeof e.first === 'object' && typeof e.first.name === 'string' && e.first.name.trim() !== '' && e.first.name.length <= 2000
  && okDate(e.first.startDate) && okDn(e.first.endDate) && (e.first.venue == null || (typeof e.first.venue === 'string' && e.first.venue.length <= 2000)) && okDate(e.first.at)
  && okDn(e.last_seen) && okDn(e.gone_at) && (e.changes == null || (Array.isArray(e.changes) && e.changes.length <= 200));
export const okHistClaim = (c) => !!c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim() !== '' && c.name.length <= 2000 && okDate(c.startDate) && okDn(c.endDate);
// At most 20 changes shown per event, 3000 events and 3000 claims in all (AppSec review, 19 Nov 2026: a bounded page).
export const PAST_MAX = { events: 3000, claims: 3000, changes: 20 };
// A rolling start: the source now gives a later start date that is still within the event's run as first listed (Agenda LX
// gives a running exhibition's next date: 160 of 166 start-date changes in Lisbon on 20 Nov 2026 were this). It is not a
// reschedule, so it is counted apart and not shown as a change.
// Tight (AppSec review, 20 Nov 2026): both dates within the first-listed run (start to end, at most a year), the new start
// later than the old and no more than 7 days after the read that saw it: the source's next open day for a running event,
// after a weekend or a closure (21 Nov 2026: 31 such moves, Saturday to Monday and the like).
export const isRolling = (e, c) => {
  if (c.field !== 'startDate' || typeof c.from !== 'string' || typeof c.to !== 'string' || !okDate(c.from) || !okDate(c.to) || !okDate(c.at)) return false;
  const s0 = dayPart(e.first.startDate), s1 = dayPart(e.first.endDate), f = dayPart(c.from), t = dayPart(c.to);
  if (!e.first.endDate || !okDate(e.first.endDate) || s1 < s0 || s1 > addDays(s0, 366)) return false;
  return f >= s0 && t > f && t <= s1 && t <= addDays(dayPart(c.at), 7);
};
export const histAllChangesOf = (e) => arr(e.changes).slice(0, 200).filter((c) => c && typeof c === 'object' && typeof c.field === 'string' && /^[A-Za-z_]{1,40}$/.test(c.field) && okDate(c.at) && okHistVal(c.from) && okHistVal(c.to));
export const histChangesOf = (e) => histAllChangesOf(e).filter((c) => !isRolling(e, c));
export const histRollingOf = (e) => histAllChangesOf(e).filter((c) => isRolling(e, c));
// files: history files, each { place, history_from, data_read_at, events, claims }. A region's own file goes last: one event per
// url, one claim per name and start date (the Algarve's file repeated its towns' claims until data.b@'s 15cdd1e).
export function pastOf(files) {
  const fs = arr(files).filter((h) => h && typeof h === 'object' && okId(h.place));
  if (!fs.length) return null;
  const seen = new Set(), seenC = new Set(), events = [], claims = [];
  for (const h of fs) {
    for (const e of arr(h.events).filter(okHistEvent)) if (!seen.has(e.url) && events.length < PAST_MAX.events) { seen.add(e.url); events.push({ ...e, place: h.place }); }
    for (const c of arr(h.claims).filter(okHistClaim)) { const k = `${clean(c.name).toLowerCase()}|${dayPart(c.startDate)}`; if (!seenC.has(k) && claims.length < PAST_MAX.claims) { seenC.add(k); claims.push({ ...c, place: h.place }); } }
  }
  const endH = (e) => dayPart(e.first.endDate || e.first.startDate);
  const times = (k) => fs.map((h) => h[k]).filter((x) => typeof x === 'string' && okDate(x)).sort();
  return {
    from: times('history_from')[0] || '', oldest: times('data_read_at')[0] || '', readAt: times('data_read_at').pop() || '',
    events, claims,
    changed: events.filter((e) => histChangesOf(e).length),
    rolling: events.filter((e) => histRollingOf(e).length && !histChangesOf(e).length),
    gone: events.filter((e) => e.gone_at),
    passed: events.filter((e) => endH(e) < today).sort((a, b) => endH(b).localeCompare(endH(a))),
    claimsPassed: claims.filter((c) => dayPart(c.endDate || c.startDate) < today),
  };
}
const histVal = (v) => (v == null || v === '' ? '(none)' : clean(String(v).slice(0, 500)).slice(0, 200));
function histItem(e, showPlace, all = false) {
  // an event with a real change shows every change it has, a rolling start included, so the pair reads together
  const ch = (all || histChangesOf(e).length ? histAllChangesOf(e) : []).slice(0, PAST_MAX.changes).map((c) => n('li', null, `${c.field}: from ${histVal(c.from)} to ${histVal(c.to)} `, n('span', { class: 'small' }, `(seen ${fmtStamp(c.at)})`)));
  return n('li', null, n('b', null, e.first.name), showPlace ? [' ', n('span', { class: 'small' }, `(${nameOf(e.place)})`)] : '',
    `: first listed for ${fmtWhen(e.first.startDate, e.first.endDate)}${e.first.venue ? ` at ${e.first.venue}` : ''} `,
    n('span', { class: 'small' }, `(first seen ${fmtStamp(e.first.at)}; last seen in its source ${fmtStamp(e.last_seen)}${e.gone_at ? `; gone from its source ${fmtStamp(e.gone_at)}` : ''}; `, A(e.url, `its page on ${host(e.url) || 'its source'}`), ')'),
    ch.length ? n('ul', { class: 'changes' }, ch) : '');
}
// The section's content (its heading and status line stay on the page). opts: name, showPlace, cadence.
export function pastTree(H, { name, showPlace = false, cadence = 'twice a day' } = {}) {
  const list = (xs) => n('ul', { class: 'past' }, xs.map((e) => histItem(e, showPlace)));
  const from = fmtStamp(H.from);
  return [
    n('p', null, `Since ${from}, data.promptugal.news has kept each event listed for ${name} exactly as its source first listed it, and every change seen since. Kept: `,
      n('b', null, String(H.events.length)), ' events. Changed since: ', n('b', null, String(H.changed.length)), '. Gone from their source before their date: ', n('b', null, String(H.gone.length)),
      `.${!H.changed.length && !H.gone.length && H.events.length ? ' None has changed or gone since it was first seen.' : ''}${H.rolling.length ? ` For ${H.rolling.length} more, the source now gives a later start date within the run first listed, within a week of the read (the next open day of a running event): not counted as a change.` : ''} Before ${from} nothing was kept: a gap, not an absence. data.promptugal.news collects events ${cadence}, so a change is dated by the collection that first saw it.`),
    ...(H.passed.length
      ? [n('h3', null, `Dates passed (${H.passed.length})`), n('p', { class: 'small' }, 'What the organiser said would happen, as first listed. We have no record that it did; the history shows only whether the listing changed.'), list(H.passed)]
      : [n('p', { class: 'small' }, `No event kept for ${name} has reached its date yet.`)]),
    ...(H.changed.length ? [n('h3', null, `Changed since first listed (${H.changed.length})`), list(H.changed)] : []),
    ...(H.gone.length ? [n('h3', null, `Gone from their source before their date (${H.gone.length})`), list(H.gone)] : []),
    // every rolling start shown, folded, so none is hidden from a reader who wants to judge it (AppSec review, 21 Nov 2026)
    ...(H.rolling.length ? [n('details', { class: 'small' }, n('summary', null, `The ${H.rolling.length} next-date moves, not counted as changes`),
      n('p', null, 'A later start date within the run first listed, within a week of the read: most likely the next open day of a running event, though a short postponement would look the same.'),
      n('ul', { class: 'past' }, H.rolling.map((e) => histItem(e, showPlace, true))))] : []),
    n('p', null, 'Claims found through Perplexity, kept as answered with their evidence, to be checked when their date comes: ', n('b', null, String(H.claims.length)),
      H.claimsPassed.length ? `, ${H.claimsPassed.length} of them with their date passed` : '', '. None checked yet: they are claims, not confirmed listings.'),
  ];
}
