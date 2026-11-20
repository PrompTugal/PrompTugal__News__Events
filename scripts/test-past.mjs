// Tests for the past view's change rules (src/assets/render.mjs). events.b@PrompTugal.dinis, 20 November 2026. Code: Apache-2.0.
import { isRolling, histChangesOf, histRollingOf, pastOf, setToday } from '../src/assets/render.mjs';
setToday('2026-11-20');
const ev = (first, changes) => ({ url: 'https://x.example/e', first: { name: 'E', at: '2026-11-18T23:43:48Z', ...first }, changes });
const sd = (from, to) => ({ field: 'startDate', from, to, at: '2026-11-20T07:14:07Z' });
const cases = [
  ['a later start within the run as first listed is rolling', () => isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), sd('2026-11-19', '2026-11-20'))],
  ['a start moved past the first-listed end is a change', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), sd('2026-11-19', '2026-12-02'))],
  ['an earlier start is a change', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), sd('2026-11-19', '2026-11-18'))],
  ['a single-day event moved a day is a change', () => !isRolling(ev({ startDate: '2026-11-19' }), sd('2026-11-19', '2026-11-20'))],
  ['an end-date change is never rolling', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), { field: 'endDate', from: '2026-11-30', to: null, at: '2026-11-20T07:14:07Z' })],
  ['a start moved before the first-listed start is a change', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), sd('2026-11-01', '2026-11-05'))],
  ['a start moved well after the day it was seen is a change, even within the run', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), sd('2026-11-19', '2026-11-26'))],
  ['a run of more than a year, or an end before the start, never makes a rolling start', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2028-01-01' }), sd('2026-11-19', '2026-11-20')) && !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-01' }), sd('2026-11-19', '2026-11-20'))],
  ['non-string dates are never rolling', () => !isRolling(ev({ startDate: '2026-11-19', endDate: '2026-11-30' }), { field: 'startDate', from: 20261119, to: 20261120, at: '2026-11-20T07:14:07Z' })],
  ['a real change past the 20th change still counts as changed', () => {
    const many = Array.from({ length: 25 }, (_, i) => sd('2026-11-19', '2026-11-20'));
    many.push({ field: 'venue', from: 'A', to: 'B', at: '2026-11-20T08:00:00Z' });
    const H = pastOf([{ place: 'lisboa', events: [ev({ startDate: '2026-11-19', endDate: '2026-11-30' }, many)] }]);
    return H.changed.length === 1 && H.rolling.length === 0;
  }],
  ['pastOf counts rolling apart from changed', () => {
    const H = pastOf([{ place: 'lisboa', events: [ev({ startDate: '2026-11-19', endDate: '2026-11-30' }, [sd('2026-11-19', '2026-11-20')]), { ...ev({ startDate: '2026-11-19' }, [sd('2026-11-19', '2026-11-21')]), url: 'https://x.example/f' }] }]);
    return H.rolling.length === 1 && H.changed.length === 1;
  }],
  ['an event with a real change and a rolling start counts once, as changed', () => {
    const e = ev({ startDate: '2026-11-19', endDate: '2026-11-26' }, [sd('2026-11-19', '2026-11-26'), { field: 'endDate', from: '2026-11-26', to: null, at: '2026-11-20T07:14:12Z' }]);
    const H = pastOf([{ place: 'lisboa', events: [e] }]);
    return H.changed.length === 1 && H.rolling.length === 0 && histChangesOf(e).length === 2 && histRollingOf(e).length === 0;
  }],
];
let failed = 0;
for (const [n, fn] of cases) { let r = false; try { r = fn(); } catch (err) { console.error('  error:', err.message); } if (!r) { failed++; console.error(`FAIL: ${n}`); } }
if (failed) { console.error(`past tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`past tests OK (${cases.length} cases)`);
