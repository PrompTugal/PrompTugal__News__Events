// Sync: copy the events data this site reads from data.promptugal.news into data/api/, with a record of when.
// It is not a collector: it reads only what data.promptugal.news already publishes (collected there by
// data.b@PrompTugal.dinis's code and its Perplexity discovery) and never calls an agenda, Perplexity or OpenRouter.
//   data/api/index.json                  /api/v1/events/by-place/index.json
//   data/api/by-place/<place>.json       /api/v1/events/by-place/<place>.json   (events read from sources we may read)
//   data/api/claims-index.json           /api/v1/events/claims/by-place/index.json
//   data/api/claims/<place>.json         /api/v1/events/claims/by-place/<place>.json (found through Perplexity)
//   data/api/events-pt.json              /api/v1/events-pt/latest.json: provenance, counts and gaps only (not the events again)
//   data/api/sources/            /api/v1/sources/index.json, /api/v1/sources/<id>.json and /api/v1/sources/gaps.json (the register)
//   data/api/sync.json                   when each file was read, and what failed
// On a failed read the last copy in git is kept and the failure is recorded. Node 18+, no dependencies.
// events.b@PrompTugal.dinis, 18 November 2026. Code: Apache-2.0.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://data.promptugal.news/api/v1/';
const UA = { 'user-agent': 'events.promptugal.news sync (PrompTugal/PrompTugal__News__Events)' };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const log = { about: 'When this site last read each file from data.promptugal.news, and what failed. Written by scripts/sync-data.mjs.', started: new Date().toISOString(), read: [], failed: [] };

async function get(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API + path, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
      if (r.status === 404) throw new Error('HTTP 404');
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === 2 || /404/.test(e.message)) throw e;
      await pause(1500 * (i + 1));
    }
  }
}
function save(file, data) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data, null, 1) + '\n'); }
async function copy(path, file, pick) {
  try {
    const d = await get(path);
    save(file, pick ? pick(d) : d);
    log.read.push({ path, file, at: new Date().toISOString() });
    return d;
  } catch (e) {
    log.failed.push({ path, file, why: e.message, kept: existsSync(file) ? 'the last copy in git' : 'none' });
    return null;
  } finally { await pause(300); }
}

const index = await copy('events/by-place/index.json', 'data/api/index.json');
const claimsIndex = await copy('events/claims/by-place/index.json', 'data/api/claims-index.json');
// Claims per town, and for the region "algarve" (all its towns; added by data.b@ on 18 Nov, not yet in the index).
const okId = (p) => /^[a-z0-9-]+$/.test(p) || (log.failed.push({ path: String(p), why: 'not a place id' }), false);
for (const p of (Array.isArray(index?.places) ? index.places : []).map((x) => x?.id).filter(okId).sort()) await copy(`events/by-place/${p}.json`, `data/api/by-place/${p}.json`);
for (const p of [...new Set([...(Array.isArray(claimsIndex?.places) ? claimsIndex.places : []).map((x) => x?.place), 'algarve'])].filter(okId).sort()) await copy(`events/claims/by-place/${p}.json`, `data/api/claims/${p}.json`);
// The sources register (every source, read and not read, and why) and the hosts Perplexity cited that we do not read.
const register = await copy('sources/index.json', 'data/api/sources/index.json');
for (const id of (Array.isArray(register?.entries) ? register.entries : []).map((x) => x?.id).filter(okId).sort()) await copy(`sources/${id}.json`, `data/api/sources/${id}.json`);
await copy('sources/gaps.json', 'data/api/sources/gaps.json');
await copy('events-pt/latest.json', 'data/api/events-pt.json', (d) => ({ license: d.license, source: d.source, title: d.title, read_at: d.read_at, provenance: d.provenance, about: d.about, counts: d.counts, gaps: d.gaps }));
// The registry of the PrompTugal sites, for the sites bar (rendered at build; on a failed read the last good copy stays in git).
try {
  const r = await fetch('https://promptugal.news/api/v1/sites.json', { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  save('data/sites/sites.json', await r.json());
  log.read.push({ path: 'https://promptugal.news/api/v1/sites.json', file: 'data/sites/sites.json', at: new Date().toISOString() });
} catch (e) { log.failed.push({ path: 'https://promptugal.news/api/v1/sites.json', why: e.message, kept: existsSync('data/sites/sites.json') ? 'the last copy in git' : 'none' }); }
log.finished = new Date().toISOString();
save('data/api/sync.json', log);
console.log(`synced ${log.read.length} files from ${API}${log.failed.length ? `; ${log.failed.length} failed (kept the last copy): ${log.failed.map((f) => f.path).join(', ')}` : ''}`);
