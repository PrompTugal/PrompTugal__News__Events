// Data in the browser (Dinis, 19 Nov 2026 ~01:13 UTC, Website board/guidance/2026-11-19-load-the-data-in-the-browser.md).
// Where a page has <div id="events" data-places="...">, fetch those places' events from data.promptugal.news (our own data
// host; no cookie, no referrer) when the page opens and every 10 minutes, and re-draw the list with the same renderer as the
// build, as DOM nodes with textContent (never innerHTML). A file replaces the built list only if it passes its checks: the
// expected shape, items within bounds, and a read time no older than the built copy. Otherwise the built page stays.
// The status line says whether the page shows the live file or the built copy, when it was read, and if it is stale.
// events.b@PrompTugal.dinis, 18 and 19 November 2026. Code: Apache-2.0.
import * as R from './render.mjs';

const API = `${R.DATA}/api/v1/events`;
const CADENCE_H = 7; // data.promptugal.news reads the agendas every 6 hours; older than 7 hours is stale
const MAX_ITEMS = 5000;

async function getJson(url) {
  // redirects refused (security@, 19 Nov 2026): a file must come from the fixed address on our own host
  const r = await fetch(url, { cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', redirect: 'error' });
  if (!r.ok || r.redirected || (r.url && !r.url.startsWith(API + '/'))) throw new Error(String(r.status));
  return r.json();
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
  const stale = Date.now() - new Date(readAt).getTime() > CADENCE_H * 3600e3;
  say(status, `${stale ? 'Stale: the live file was last read' : 'Live file: read from data.promptugal.news, its data read'} ${R.fmtStamp(readAt)}. "Today" is ${R.fmtDay(R.today)}, Lisbon time. ${R.licenceOf(feeds.flatMap((f) => [f.read, f.claims]))} Each event under its source's licence or terms, on its card.`, stale);
}

const box = document.getElementById('events');
const status = document.getElementById('events-status');
if (box && 'fetch' in window) {
  const run = () => refresh(box, status).catch(() => { /* the built copy stays, and its status line says so */ });
  run();
  setInterval(run, 10 * 60 * 1000);
}
