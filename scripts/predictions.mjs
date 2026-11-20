// This site's predictions for the library (Dinis, 19 Nov 2026 ~03:15 UTC: "The predictions are one collection"; ~01:22 UTC:
// every prediction is kept and checked; the form: https://library.promptugal.news/predictions/form/).
// An events listing is the organiser's prediction: this event, on this date. Each event read from an agenda, as data.b@'s events
// history first kept it (data/api/history/<place>.json), becomes one "expected-date" prediction line in
// data/predictions/predictions.jsonl. When its date has passed, one "outcome" line follows: a gap, since no source we read
// reports whether an event took place. Append only: existing lines are never changed; this script adds lines and refuses to
// run if the file it finds is not valid. Claims found through Perplexity are not sent yet.
// Run at a wake, then commit: CI never writes this file. Usage: node scripts/predictions.mjs [--dry-run]
// events.b@PrompTugal.dinis, 20 November 2026. Code: Apache-2.0.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkLine } from './check-predictions.mjs';
import { nameOf } from '../src/assets/render.mjs';

const FILE = 'data/predictions/predictions.jsonl';
const SITE = 'events.promptugal.news';
const DRY = process.argv.includes('--dry-run');
const lisbonDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = lisbonDay(new Date());
const minute = (iso) => new Date(iso).toISOString().slice(0, 16) + 'Z';
// The library refuses [ ] < > and backticks in text, and control characters.
// control, format (bidi, zero-width) and line-separator characters go; cut by code point, never inside a pair (AppSec review)
const text = (s, n) => Array.from(String(s ?? '').replace(/[\p{C}\u2028\u2029]/gu, ' ').replace(/[[]/g, '(').replace(/[\]]/g, ')').replace(/[<>`]/g, '').replace(/\s+/g, ' ').trim()).slice(0, n).join('').trim();
const okHttps = (u) => typeof u === 'string' && /^https:\/\/[^\s<>"'`\\[\]]+$/i.test(u) && u.length <= 2000 && !/[\u0000-\u001f\u007f-\u009f]/.test(u)
  && (() => { try { const x = new URL(u); return x.protocol === 'https:' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x.hostname) && !x.username && !x.password; } catch { return false; } })();
const okDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.slice(0, 10)) && !isNaN(new Date(`${d.slice(0, 10)}T00:00Z`)) && new Date(`${d.slice(0, 10)}T00:00Z`).toISOString().slice(0, 10) === d.slice(0, 10);
const okTime = (t) => typeof t === 'string' && !isNaN(new Date(t));
const MAX_NEW = 5000; // new lines per run, so a churning source cannot fill the file (AppSec review)

// The lines already in the file: they must all pass, and they are kept byte for byte.
const old = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
if (old && !old.endsWith('\n')) { console.error(`predictions: ${FILE} does not end with a newline: refused`); process.exit(1); }
const lines = old ? old.slice(0, -1).split('\n') : [];
const have = new Set(), outcomes = new Set();
lines.forEach((l, i) => {
  let o; try { o = JSON.parse(l); } catch { console.error(`predictions: line ${i + 1} is not JSON: refused`); process.exit(1); }
  const why = checkLine(o); if (why) { console.error(`predictions: line ${i + 1}: ${why}: refused`); process.exit(1); }
  if (o.type === 'prediction') have.add(o.id); else outcomes.add(o.of);
});

const add = [];
const files = readdirSync('data/api/history').filter((f) => /^[a-z0-9-]+\.json$/.test(f) && f !== 'index.json').sort();
const seen = new Set();
for (const f of files) {
  const h = JSON.parse(readFileSync(`data/api/history/${f}`, 'utf8'));
  const place = f.slice(0, -5);
  if (h.place !== place) continue;
  for (const e of Array.isArray(h.events) ? h.events : []) {
    if (add.length >= MAX_NEW) break;
    if (!e || !okHttps(e.url) || !e.first || typeof e.first.name !== 'string' || !okDay(e.first.startDate) || !okTime(e.first.at) || (e.first.endDate && !okDay(e.first.endDate)) || (e.last_seen && !okTime(e.last_seen)) || (e.gone_at && !okTime(e.gone_at)) || seen.has(e.url)) continue;
    try {
    seen.add(e.url);
    const id = `ev.${createHash('sha256').update(e.url).digest('hex').slice(0, 20)}`;
    const due = (e.first.endDate && okDay(e.first.endDate) ? e.first.endDate : e.first.startDate).slice(0, 10);
    const label = /\(([^)]+)\)\s*$/.exec(String(e.source || ''))?.[1] || new URL(e.url).hostname.replace(/^www\./, '');
    const lic = e.licence && typeof e.licence === 'object' ? e.licence : {};
    if (!have.has(id)) {
      const start = e.first.startDate.slice(0, 10), end = (e.first.endDate || '').slice(0, 10);
      add.push({
        type: 'prediction', id, site: SITE, page: `https://${SITE}/places/${place}/`, shown_at: minute(e.first.at),
        said_by: text(label, 80), source: e.url,
        licence: { name: text(lic.name || "the source's terms", 80), url: okHttps(lic.url) ? lic.url : e.url },
        kind: 'expected-date', subject: text(`${e.first.name} (${nameOf(place)})`, 120), due,
        said: text(`${e.first.name}: ${end && end !== start ? `from ${start} to ${end}` : start}${e.first.venue ? `, at ${e.first.venue}` : ''}, as first listed`, 300),
        // first seen after its date: the outcome could already be known, so a retrospective record
        ...(minute(e.first.at).slice(0, 10) > due ? { backfilled: true } : {}),
      });
      have.add(id);
    }
    if (due < today && !outcomes.has(id)) {
      add.push({ type: 'outcome', of: id, checked_at: minute(new Date().toISOString()), result: 'gap',
        gap: text(`The date has passed. No source we read reports whether it took place; the organiser's page listed it until ${e.last_seen ? minute(e.last_seen) : 'its first read'}${e.gone_at ? `, and it went from that page at ${minute(e.gone_at)}` : ''}.`, 400) });
      outcomes.add(id);
    }
    } catch (err) { console.warn(`predictions: skipped one entry in ${f} (${String(err.message).slice(0, 80)})`); }
  }
}
// A new line that fails the library's checks is dropped and logged (with its outcome), never written.
const bad = new Set(add.filter((o) => o.type === 'prediction' && checkLine(o)).map((o) => { console.warn(`predictions: dropped ${o.id} (${checkLine(o)})`); return o.id; }));
for (let i = add.length - 1; i >= 0; i--) if (bad.has(add[i].id) || bad.has(add[i].of)) add.splice(i, 1);
for (const o of add) { const why = checkLine(o); if (why) { console.error(`predictions: a new line fails (${why}): ${o.id || o.of}`); process.exit(1); } }
const out = old + add.map((o) => JSON.stringify(o) + '\n').join('');
if (!DRY && add.length) { mkdirSync('data/predictions', { recursive: true }); writeFileSync(FILE, out); }
console.log(`predictions: ${add.filter((o) => o.type === 'prediction').length} predictions and ${add.filter((o) => o.type === 'outcome').length} outcomes ${DRY ? 'would be ' : ''}added (${lines.length + add.length} lines in all)`);
