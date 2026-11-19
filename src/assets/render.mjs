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
