// The data gate (finding EV-2026-006): checks the copy of data.promptugal.news that scripts/sync-data.mjs wrote into
// data/api/ before the site is built from it. It reads local files only and prints short reasons, never the data.
//   node scripts/check-data.mjs            report; exit 1 if the data fails
//   node scripts/check-data.mjs --restore  on failure, put back the last copy committed in git (data/api/) and exit 0,
//                                          so a bad sync never reaches the site (fails closed: the last good data deploys)
// The rules match the renderer's (src/assets/render.mjs): ids [a-z0-9-], dates YYYY-MM-DD with an optional time,
// links http or https only; plus limits on size, counts and types. Node 18+, no dependencies.
// events.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
import { readFileSync, readdirSync, statSync, lstatSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) || 'data/api';
const RESTORE = process.argv.includes('--restore');
// --restore runs git checkout and git clean on DIR, so it is allowed on data/api only.
if (RESTORE && DIR !== 'data/api') { console.error('check-data: --restore works on data/api only'); process.exit(1); }
const LIMITS = { fileBytes: 5 * 1024 * 1024, totalBytes: 60 * 1024 * 1024, items: 5000, text: 2000, badShare: 0.1 };
const okId = (p) => typeof p === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p) && p.length <= 80;
const okDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(d);
const okUrl = (u) => typeof u === 'string' && u.length <= LIMITS.text && /^https?:\/\/[^\s<>"'`\\]+$/i.test(u);
const okText = (s) => typeof s === 'string' && s.trim() !== '' && s.length <= LIMITS.text;
const problems = [];
const fail = (file, why) => problems.push(`${file}: ${why}`);

// No symbolic links: a link could loop or reach outside DIR.
function walk(d) { return existsSync(d) ? readdirSync(d).flatMap((f) => { const p = join(d, f); const st = lstatSync(p); if (st.isSymbolicLink()) { fail(p, 'symbolic link'); return []; } return st.isDirectory() ? walk(p) : [p]; }) : []; }
function load(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { fail(file, 'not JSON'); return null; }
}
// Items: a few bad ones are skipped by the renderer; many bad ones mean the feed is broken or tampered with.
function items(file, list, check) {
  if (!Array.isArray(list)) return fail(file, 'list is not an array');
  if (list.length > LIMITS.items) return fail(file, `more than ${LIMITS.items} items`);
  const bad = list.filter((x) => !check(x)).length;
  if (list.length && bad / list.length > LIMITS.badShare) fail(file, `${bad} of ${list.length} items malformed`);
}
const okEvent = (e) => e && typeof e === 'object' && okText(e.name) && okDate(e.startDate) && (e.endDate == null || e.endDate === '' || okDate(e.endDate))
  && (e.url == null || okUrl(e.url)) && (e.place == null || okId(e.place)) && (e.license == null || typeof e.license === 'object');
const okClaim = (c) => okEvent({ ...c, url: null }) && (c.evidence == null || (Array.isArray(c.evidence) && c.evidence.every((x) => x && okUrl(x.url))));

// The events history: each event as first listed (never overwritten), every change seen, last seen, gone.
const okCount = (x) => Number.isInteger(x) && x >= 0 && x <= 1e6;
// A change's from and to: a short string, a number or nothing, never an object (AppSec review, 19 Nov 2026).
const okVal = (v) => v == null || (typeof v === 'string' && v.length <= 500) || (typeof v === 'number' && Number.isFinite(v));
const okHist = (e) => e && typeof e === 'object' && okUrl(e.url) && e.first && typeof e.first === 'object' && okText(e.first.name) && okDate(e.first.startDate)
  && (e.first.endDate == null || e.first.endDate === '' || okDate(e.first.endDate)) && (e.first.venue == null || (typeof e.first.venue === 'string' && e.first.venue.length <= LIMITS.text))
  && okDate(e.first.at) && Array.isArray(e.changes) && e.changes.length <= 200
  && e.changes.every((c) => c && typeof c === 'object' && typeof c.field === 'string' && /^[A-Za-z_]{1,40}$/.test(c.field) && okDate(c.at) && okVal(c.from) && okVal(c.to))
  && (e.last_seen == null || okDate(e.last_seen)) && (e.gone_at == null || okDate(e.gone_at));
const files = walk(DIR).filter((f) => f.endsWith('.json'));
let total = 0;
for (const f of files) {
  const size = statSync(f).size; total += size;
  if (size > LIMITS.fileBytes) { fail(f, `larger than ${LIMITS.fileBytes} bytes`); continue; }
  const d = load(f); if (!d) continue;
  if (typeof d !== 'object' || Array.isArray(d)) { fail(f, 'not an object'); continue; }
  const rel = f.slice(DIR.length + 1);
  if (rel === 'index.json') { items(f, d.places, (p) => p && okId(p.id)); if (!Array.isArray(d.places) || !d.places.length) fail(f, 'no places'); }
  else if (rel === 'claims-index.json') items(f, d.places, (p) => p && okId(p.place));
  else if (/^by-place\/[a-z0-9-]+\.json$/.test(rel)) items(f, d.events, okEvent);
  else if (/^claims\/[a-z0-9-]+\.json$/.test(rel)) items(f, d.claims, okClaim);
  else if (rel === 'history/index.json') { items(f, d.places, (p) => p && okId(p.place) && ['events', 'changed', 'gone', 'claims'].every((k) => okCount(p[k]))); if (Array.isArray(d.places) && d.places.length > 200) fail(f, 'more than 200 places'); if (d.history_from != null && !okDate(d.history_from)) fail(f, 'bad history_from'); }
  else if (/^history\/[a-z0-9-]+\.json$/.test(rel)) {
    if (!okId(d.place) || `history/${d.place}.json` !== rel) fail(f, 'place does not match the file');
    if (d.history_from != null && !okDate(d.history_from)) fail(f, 'bad history_from');
    items(f, d.events ?? [], okHist); items(f, d.claims ?? [], okClaim);
  }
  else if (rel === 'sources/index.json') items(f, d.entries, (e) => e && okId(e.id));
  else if (rel === 'sources/gaps.json') items(f, d.hosts, (h) => h && okText(h.host) && (h.example == null || okUrl(h.example)));
  else if (/^sources\/[a-z0-9-]+\.json$/.test(rel)) { if (!okId(d.id)) fail(f, 'bad id'); if (d.url != null && !okUrl(d.url)) fail(f, 'bad url'); }
  else if (rel === 'events-pt.json') {
    const srcs = d.provenance?.sources;
    if (srcs != null) items(f, srcs, (s) => s && okText(s.what) && okText(s.host) && okUrl(s.route) && (s.terms == null || okText(s.terms)));
    if (d.gaps != null) items(f, d.gaps, (g) => g && okText(g.host) && (g.why == null || okText(g.why)));
  }
  else if (rel === 'sync.json') { if (d.finished != null && !okDate(String(d.finished).slice(0, 10))) fail(f, 'bad time'); }
  else fail(f, 'unexpected file');
  if (!d.license && rel !== 'sync.json') fail(f, 'no license field');
}
if (total > LIMITS.totalBytes) fail(DIR, `larger than ${LIMITS.totalBytes} bytes in all`);
if (!files.length) fail(DIR, 'no data');

if (!problems.length) { console.log(`data OK (${files.length} files, ${Math.round(total / 1024)} KB)`); process.exit(0); }
console.error(problems.slice(0, 20).join('\n') + (problems.length > 20 ? `\n... and ${problems.length - 20} more` : ''));
if (!RESTORE) { console.error(`data FAILED (${problems.length})`); process.exit(1); }
// Fail closed: drop what the sync wrote and put back the last committed copy, which the site then builds from.
execFileSync('git', ['checkout', '--', DIR]);
execFileSync('git', ['clean', '-fdq', '--', DIR]);
console.error(`data FAILED (${problems.length}): kept the last copy committed in git`);
// Visible in the CI run's summary without failing the deploy of the last good data.
if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Data gate::the synced data failed ${problems.length} check(s); the site was built from the last committed copy`);
