// The predictions file's gate: data/predictions/predictions.jsonl must pass the library's checks line by line
// (https://library.promptugal.news/predictions/form/) and, against a base revision, only grow: every line already at the base
// is kept byte for byte, in order, and new lines only follow (append only; a correction is a new line).
// Usage: node scripts/check-predictions.mjs [base-rev]. events.b@PrompTugal.dinis, 20 November 2026. Code: Apache-2.0.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = 'data/predictions/predictions.jsonl';
const ID = /^[A-Za-z0-9._-]{1,100}$/;
const MIN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (s) => { const d = new Date(s.length === 10 ? `${s}T00:00Z` : s); return !isNaN(d) && d.toISOString().slice(0, s.length === 10 ? 10 : 16) === s.slice(0, s.length === 10 ? 10 : 16); };
const okMin = (s) => typeof s === 'string' && MIN.test(s) && realDate(s);
const okDue = (s) => typeof s === 'string' && (DAY.test(s) || MIN.test(s)) && realDate(s);
const okHttps = (u) => typeof u === 'string' && u.length <= 2000 && /^https:\/\/[^\s<>"'`\\[\]]+$/i.test(u) && !/[\u0000-\u001f\u007f-\u009f]/.test(u)
  && (() => { try { const x = new URL(u); return x.protocol === 'https:' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x.hostname) && !x.username && !x.password; } catch { return false; } })();
const okText = (s, n) => typeof s === 'string' && s.trim() !== '' && [...s].length <= n && !/[\p{C}[\]<>`]/u.test(s);
const KINDS = new Set(['forecast', 'warning', 'countdown', 'score', 'expected-date', 'statement']);
const PRED = new Set(['type', 'id', 'site', 'page', 'shown_at', 'said_by', 'source', 'licence', 'kind', 'subject', 'due', 'said', 'value', 'backfilled', 'corrects']);
const OUT = new Set(['type', 'of', 'checked_at', 'result', 'happened', 'value', 'difference', 'evidence', 'gap']);

export function checkLine(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 'not an object';
  if (o.type === 'prediction') {
    for (const k of Object.keys(o)) if (!PRED.has(k)) return `unknown field ${k.slice(0, 40)}`;
    if (!ID.test(o.id || '')) return 'bad id';
    if (o.site !== 'events.promptugal.news') return 'site is not this host';
    if (!okHttps(o.page) || !o.page.startsWith('https://events.promptugal.news/')) return 'bad page';
    if (!okMin(o.shown_at)) return 'bad shown_at';
    if (!okText(o.said_by, 80)) return 'bad said_by';
    if (!okHttps(o.source)) return 'bad source';
    if (!o.licence || typeof o.licence !== 'object' || !okText(o.licence.name, 120) || !okHttps(o.licence.url) || Object.keys(o.licence).some((k) => k !== 'name' && k !== 'url')) return 'bad licence';
    if (!KINDS.has(o.kind)) return 'bad kind';
    if (!okText(o.subject, 120)) return 'bad subject';
    if (!okDue(o.due)) return 'bad due';
    if (!okText(o.said, 300)) return 'bad said';
    if (o.value != null && (typeof o.value !== 'object' || Object.values(o.value).some((v) => v && typeof v === 'object'))) return 'bad value';
    if (o.backfilled != null && typeof o.backfilled !== 'boolean') return 'bad backfilled';
    if (o.corrects != null && !ID.test(o.corrects)) return 'bad corrects';
    return '';
  }
  if (o.type === 'outcome') {
    for (const k of Object.keys(o)) if (!OUT.has(k)) return `unknown field ${k.slice(0, 40)}`;
    if (!ID.test(o.of || '')) return 'bad of';
    if (!okMin(o.checked_at)) return 'bad checked_at';
    if (!['held', 'missed', 'gap'].includes(o.result)) return 'bad result';
    if (o.result === 'gap') { if (!okText(o.gap, 400)) return 'a gap needs its reason'; }
    else {
      if (!okText(o.happened, 400)) return 'bad happened';
      if (!Array.isArray(o.evidence) || !o.evidence.length || !o.evidence.every(okHttps)) return 'bad evidence';
    }
    if (o.difference != null && !okText(o.difference, 80)) return 'bad difference';
    return '';
  }
  return 'type is neither prediction nor outcome';
}

export function checkFile(text, baseText = '') {
  const fails = [];
  if (text && !text.endsWith('\n')) fails.push('the file does not end with a newline');
  if (Buffer.byteLength(text) > 20 * 1024 * 1024) fails.push('larger than 20 MB');
  if (baseText && !text.startsWith(baseText)) fails.push('an existing line was changed, removed or moved: the file is append only');
  const lines = text ? text.replace(/\n$/, '').split('\n') : [];
  if (lines.length > 50000) fails.push('more than 50,000 lines');
  const ids = new Set(), outs = new Set();
  lines.forEach((l, i) => {
    let o; try { o = JSON.parse(l); } catch { fails.push(`line ${i + 1}: not JSON`); return; }
    const why = checkLine(o); if (why) { fails.push(`line ${i + 1}: ${why}`); return; }
    if (o.type === 'prediction') { if (ids.has(o.id)) fails.push(`line ${i + 1}: the id ${o.id} is used twice`); ids.add(o.id); }
    else { if (!ids.has(o.of)) fails.push(`line ${i + 1}: an outcome for an id not predicted above it`); if (outs.has(o.of)) fails.push(`line ${i + 1}: a second outcome for ${o.of}`); outs.add(o.of); }
  });
  return { fails, lines: lines.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2];
  const text = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
  // Fail closed (AppSec review, 20 Nov 2026): a base that cannot be read fails; only a base commit without the file is empty.
  let baseText = '';
  if (base) {
    const git = (a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    try { git(['cat-file', '-e', `${base}^{commit}`]); } catch { console.error(`predictions FAILED: the base ${String(base).slice(0, 40)} is not a commit here`); process.exit(1); }
    let present = true; try { git(['cat-file', '-e', `${base}:${FILE}`]); } catch { present = false; }
    if (present) baseText = git(['show', `${base}:${FILE}`]);
  }
  const { fails, lines } = checkFile(text, baseText);
  if (fails.length) { console.error(fails.slice(0, 20).join('\n')); console.error(`predictions FAILED (${fails.length})`); process.exit(1); }
  console.log(`predictions OK (${lines} lines${base ? `, append only since ${base}` : ''})`);
}
