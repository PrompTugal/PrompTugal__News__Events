// Data in the browser (Dinis, 19 Nov 2026 ~01:13 UTC, Website board/guidance/2026-11-19-load-the-data-in-the-browser.md).
// Where a page has <div id="events" data-places="...">, fetch those places' events from data.promptugal.news (our own data
// host; no cookie, no referrer) when the page opens and every 10 minutes, and re-draw the list with the same renderer as the
// build, as DOM nodes with textContent (never innerHTML). A file replaces the built list only if it passes its checks: the
// expected shape, items within bounds, and a read time no older than the built copy. Otherwise the built page stays.
// The status line says whether the page shows the live file or the built copy, when it was read, and if it is stale.
// events.b@PrompTugal.dinis, 18 and 19 November 2026. Code: Apache-2.0.
import * as R from './render.mjs';

const API = `${R.DATA}/api/v1/events`;
// Stale after the window the build wrote on the box (data-stale-after, in seconds), taken from the checked events-pt file's
// expected_cadence (data.b@'s 8f6a905: twice-daily collection, 13 hours), never from a fetched feed, which could otherwise
// hide its own staleness (AppSec review, 19 Nov 2026); within 1 hour and 1 day, else 13 hours (Dinis, 19 Nov 2026 ~16:30 UTC,
// Website board/guidance/2026-11-19-twice-a-day.md).
const STALE_DEFAULT_S = 46800;
const staleAfterS = (box) => { const s = Number(box.dataset.staleAfter); return Number.isInteger(s) && s >= 3600 && s <= 86400 ? s : STALE_DEFAULT_S; };
const MAX_ITEMS = 5000;

const HIST = `${R.DATA}/api/v1/history/events`;
async function getJson(url, base = API) {
  // redirects refused (security@, 19 Nov 2026): a file must come from the fixed address on our own host
  if (!url.startsWith(base + '/')) throw new Error('not our address');
  const r = await fetch(url, { cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', redirect: 'error' });
  if (!r.ok || r.redirected || (r.url && !r.url.startsWith(base + '/'))) throw new Error(String(r.status));
  // at most 5 MB per file, as the data gate allows (AppSec review, 19 Nov 2026)
  if (Number(r.headers.get('content-length') || 0) > 5 * 1024 * 1024) throw new Error('too large');
  const t = await r.text();
  if (t.length > 5 * 1024 * 1024) throw new Error('too large');
  return JSON.parse(t);
}
const okTime = (s) => typeof s === 'string' && !isNaN(new Date(s)) && new Date(s).getTime() <= Date.now() + 10 * 60e3; // not in the future
const okFeed = (f, key) => f && typeof f === 'object' && Array.isArray(f[key]) && f[key].length <= MAX_ITEMS && okTime(f.read_at);

function say(status, text, stale) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('stale', !!stale);
  status.classList.toggle('live', !stale);
}

async function refresh(box, status) {
  const places = (box.dataset.places || '').split(',').filter(R.okId);
  if (!places.length) return;
  R.setToday(R.lisbonDay(new Date()));
  const feeds = await Promise.all(places.map(async (p) => {
    const [read, claims] = await Promise.all([getJson(`${API}/by-place/${p}.json`), getJson(`${API}/claims/by-place/${p}.json`)]);
    if (!okFeed(read, 'events') || !okFeed(claims, 'claims')) throw new Error('shape');
    return { p, read, claims };
  }));
  const readAt = feeds.map((f) => f.read.read_at).reduce((m, x) => (new Date(x) > new Date(m) ? x : m));
  const builtAt = box.dataset.readAt || '';
  if (builtAt && new Date(readAt) < new Date(builtAt)) throw new Error('older than the built copy');
  let items = feeds.flatMap(({ p, read, claims }) => [...R.readItemsOf(read, p), ...R.foundItemsOf(claims, p)]);
  const win = Number(box.dataset.window || 0);
  if (win) { const end = R.addDays(R.today, win); items = items.filter((it) => R.startOf(it) >= R.today && R.startOf(it) < end); }
  const L = R.listTree(items, { showPlace: box.dataset.showPlace === '1' });
  if (!L.count) return; // keep the built page's own message
  box.replaceChildren(...L.nodes.map((node) => R.toDom(node, document)));
  // the counts in the page's opening line, where the page marks them
  const cur = items.filter(R.isCurrent);
  for (const el of document.querySelectorAll('[data-count]')) {
    const k = el.getAttribute('data-count');
    if (k === 'read') el.textContent = String(cur.filter((i) => i.kind === 'read').length);
    if (k === 'found') el.textContent = String(cur.filter((i) => i.kind === 'found').length);
  }
  const stale = Date.now() - new Date(readAt).getTime() > staleAfterS(box) * 1e3;
  say(status, `${stale ? 'Stale: the live file was last read' : 'Live file: read from data.promptugal.news, its data read'} ${R.fmtStamp(readAt)}. "Today" is ${R.fmtDay(R.today)}, Lisbon time. ${R.licenceOf(feeds.flatMap((f) => [f.read, f.claims]))} Each event under its source's licence or terms, on its card.`, stale);
}

// The past (Dinis ~01:17 UTC, "show the past"): <div id="past-body" data-hist="<place>,...">, redrawn from data.b@'s history
// files with the build's own renderer (pastTree), on the same terms as the events: the expected shape, items within bounds, a
// read time no older than the built copy, the stale window from the build; otherwise the built section stays.
const okHist = (h, p) => h && typeof h === 'object' && h.place === p && Array.isArray(h.events) && h.events.length <= MAX_ITEMS
  && (h.claims == null || (Array.isArray(h.claims) && h.claims.length <= MAX_ITEMS)) && okTime(h.data_read_at);
async function refreshPast(pbox, pstatus) {
  const places = (pbox.dataset.hist || '').split(',').filter(R.okId);
  if (!places.length || places.length > 40) return;
  R.setToday(R.lisbonDay(new Date()));
  const files = await Promise.all(places.map(async (p) => { const h = await getJson(`${HIST}/${p}.json`, HIST); if (!okHist(h, p)) throw new Error('shape'); return h; }));
  const H = R.pastOf(files);
  if (!H || !H.readAt) return;
  const builtAt = pbox.dataset.readAt || '';
  // every file at least as new as the built copy, so one fresh file cannot carry older, replayed ones
  if (builtAt && new Date(H.oldest) < new Date(builtAt)) throw new Error('older than the built copy');
  const cadence = /^[a-z0-9 ,-]{3,40}$/i.test(pbox.dataset.cadence || '') ? pbox.dataset.cadence : 'twice a day';
  const nodes = R.pastTree(H, { name: String(pbox.dataset.name || '').slice(0, 80), showPlace: pbox.dataset.showPlace === '1', cadence });
  pbox.replaceChildren(...nodes.map((node) => R.toDom(node, document)));
  const stale = Date.now() - new Date(H.readAt).getTime() > staleAfterS(pbox) * 1e3;
  say(pstatus, `${stale ? 'Stale: the history was last read' : 'Live files: history read from data.promptugal.news'} ${R.fmtStamp(H.readAt)}. "Today" is ${R.fmtDay(R.today)}, Lisbon time. ${R.licenceOf(files)}`, stale);
}
const pbox = document.getElementById('past-body');
if (pbox && 'fetch' in window) {
  let busy = false;
  const runPast = () => { if (busy) return; busy = true; refreshPast(pbox, document.getElementById('past-status')).catch(() => { /* the built section stays */ }).finally(() => { busy = false; }); };
  runPast();
  setInterval(runPast, 10 * 60 * 1000);
}

const box = document.getElementById('events');
const status = document.getElementById('events-status');
if (box && 'fetch' in window) {
  const run = () => refresh(box, status).catch(() => { /* the built copy stays, and its status line says so */ });
  run();
  setInterval(run, 10 * 60 * 1000);
}
