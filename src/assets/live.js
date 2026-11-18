// Live data: where a page has <div id="events" data-places="...">, fetch those places' events from
// data.promptugal.news's API (CORS open) and re-draw the list with the same renderer the build uses,
// with "today" taken in Lisbon time now, not at the build. If any read fails, the built page stays as it is.
// No cookies, no storage, no third party. events.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
import * as R from './render.mjs';

const API = `${R.DATA}/api/v1/events`;
async function getJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function refresh(box) {
  const places = (box.dataset.places || '').split(',').filter((p) => /^[a-z0-9-]+$/.test(p));
  if (!places.length) return;
  R.setToday(R.lisbonDay(new Date()));
  const feeds = await Promise.all(places.map(async (p) => {
    const [read, claims] = await Promise.all([getJson(`${API}/by-place/${p}.json`), getJson(`${API}/claims/by-place/${p}.json`)]);
    return { p, read, claims };
  }));
  let items = feeds.flatMap(({ p, read, claims }) => [...R.readItemsOf(read, p), ...R.foundItemsOf(claims, p)]);
  const win = Number(box.dataset.window || 0);
  if (win) { const end = R.addDays(R.today, win); items = items.filter((it) => R.startOf(it) >= R.today && R.startOf(it) < end); }
  const L = R.listHtml(items, { showPlace: box.dataset.showPlace === '1' });
  if (!L.count) return; // keep the built page's own message
  const readAt = feeds.map((f) => f.read?.read_at).filter(Boolean).sort().pop();
  const stale = feeds.some((f) => (f.read?.stale || []).length);
  box.innerHTML = `<p class="fresh live">Live: read from data.promptugal.news just now (its data read ${R.esc(R.fmtStamp(readAt))}${stale ? '; some sources have not answered since, and their events show when they were last read' : ''}). "Today" is ${R.esc(R.fmtDay(R.today))}, Lisbon time.</p>\n${L.html}`;
}

const box = document.getElementById('events');
if (box && 'fetch' in window) refresh(box).catch(() => { /* the built page stays */ });
