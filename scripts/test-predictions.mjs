// Tests for the predictions gate (scripts/check-predictions.mjs). events.b@PrompTugal.dinis, 20 November 2026. Code: Apache-2.0.
import { checkFile } from './check-predictions.mjs';
const P = (id, extra = {}) => JSON.stringify({ type: 'prediction', id, site: 'events.promptugal.news', page: 'https://events.promptugal.news/places/faro/', shown_at: '2026-11-18T23:43Z', said_by: 'Teatro das Figuras', source: 'https://teatrodasfiguras.pt/agenda/x', licence: { name: "the source's terms", url: 'https://teatrodasfiguras.pt/' }, kind: 'expected-date', subject: 'X (Faro)', due: '2026-11-21', said: 'X: 2026-11-21', ...extra });
const O = (of, extra = {}) => JSON.stringify({ type: 'outcome', of, checked_at: '2026-11-22T08:00Z', result: 'gap', gap: 'No source we read reports it.', ...extra });
const f = (...l) => l.join('\n') + '\n';
const ok = (t, b) => checkFile(t, b).fails.length === 0;
const fails = (t, b, re) => checkFile(t, b).fails.some((x) => re.test(x));
const base = f(P('a'), P('b'));
const cases = [
  ['a valid file passes', () => ok(f(P('a'), O('a')))],
  ['appending to the base passes', () => ok(base + f(O('a')), base)],
  ['changing an existing line fails (append only)', () => fails(f(P('a', { said: 'X: 2026-11-22' }), P('b')), base, /append only/)],
  ['removing a line fails', () => fails(f(P('b')), base, /append only/)],
  ['reordering lines fails', () => fails(f(P('b'), P('a')), base, /append only/)],
  ['a square bracket or angle bracket in text fails', () => fails(f(P('a', { said: 'X <b>' })), '', /bad said/) && fails(f(P('a', { subject: 'X [1]' })), '', /bad subject/)],
  ['another site fails', () => fails(f(P('a', { site: 'weather.promptugal.news' })), '', /site/)],
  ['a source with no host, or with a user name, fails', () => fails(f(P('a', { source: 'https://:80/x' })), '', /bad source/) && fails(f(P('a', { source: 'https://trusted@evil.example/' })), '', /bad source/)],
  ['an http source fails', () => fails(f(P('a', { source: 'http://x.example/' })), '', /bad source/)],
  ['an impossible date fails', () => fails(f(P('a', { due: '2026-13-01' })), '', /bad due/) && fails(f(P('a', { shown_at: '2026-11-31T10:00Z' })), '', /bad shown_at/)],
  ['an outcome before its prediction fails', () => fails(f(O('a'), P('a')), '', /not predicted above/)],
  ['a second outcome fails', () => fails(f(P('a'), O('a'), O('a')), '', /second outcome/)],
  ['a duplicate id fails', () => fails(f(P('a'), P('a')), '', /used twice/)],
  ['a gap without its reason fails', () => fails(f(P('a'), O('a', { gap: '' })), '', /reason/)],
  ['a held outcome needs evidence', () => fails(f(P('a'), O('a', { result: 'held', gap: undefined, happened: 'It took place.' })), '', /evidence/)],
  ['an unknown field fails', () => fails(f(P('a', { extra: 1 })), '', /unknown field/)],
  ['a file without its last newline fails', () => fails(f(P('a')).slice(0, -1), '', /newline/)],
];
let failed = 0;
for (const [n, fn] of cases) { let r = false; try { r = fn(); } catch (e) { console.error('  error:', e.message); } if (!r) { failed++; console.error(`FAIL: ${n}`); } }
if (failed) { console.error(`predictions tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`predictions tests OK (${cases.length} cases)`);
