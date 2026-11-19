// ACC-015: every non-merge commit a push adds to dev must carry a readable Agent: trailer,
// read the way git reads it: git log --format=%(trailers:key=Agent,valueonly).
// Usage: node scripts/check-commits.mjs <before> <after>   (the pushed range, before..after)
// Only ancestors of the pinned trusted base are skipped, decided by ancestry (security@'s control 8). No exemptions.
// It is run from the last release tag's copy in CI (security@'s control 7). History is not rewritten (ACC-015).
// Prints OK or lists each commit that fails and exits 1.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

const [beforeArg, afterArg] = process.argv.slice(2);
const after = afterArg || 'HEAD';
if (!tryGit('rev-parse', '--verify', '--quiet', `${after}^{commit}`)) { console.error(`check-commits: unknown commit ${after}`); process.exit(1); }

// The trusted base: this repository's seed commit, pinned by its full id. Only commits that are ancestors of it are
// skipped, decided by ancestry, never by what a tree holds, so deleting this file skips nothing (security@'s control 8).
const TRUSTED_BASE = 'aea4fc914369954a4c4a516ae65f4f770e25f812';
if (tryGit('merge-base', '--is-ancestor', TRUSTED_BASE, after) === null) { console.error(`check-commits: ${after} does not descend from the trusted base`); process.exit(1); }

// A new branch, a forced push or a manual run has no usable "before": check everything since the check began.
const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const range = before ? [`${before}..${after}`] : [after];
const added = lines(git('rev-list', '--no-merges', ...range));

// A role may be dotted, role.speciality (Dinis, 16 Nov 2026: "we definitely should allow dots because that's our terminology").
// PrompTugal agents sign as role@PrompTugal.dinis (Dinis, 18 Nov 2026, kept by conductor.b@ in
// PrompTugal__News__Website board/guidance/2026-11-18-five-sites-on-account-b.md: "In each of the five
// repos, the commit check accepts @PrompTugal.dinis agents"; the same change as PrompTugal__News__Weather's).
// Only that one address is added.
const agentShape = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@(?:agenticcells\.[a-z0-9][a-z0-9.-]*|promptugal\.dinis)$/i;
// No exemptions of any kind (security@'s controls 1 and 7: no config from the pushed tree, no exemption by name).
const errors = [];
let checked = 0;
for (const c of added) {
  if (tryGit('merge-base', '--is-ancestor', c, TRUSTED_BASE) !== null) continue;
  checked++;
  const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim());
  const subject = git('log', '-1', '--format=%s', c);
  if (!agents.length) errors.push(`${c.slice(0, 7)} ${subject}: no readable Agent: trailer (it must sit in the final trailer block)`);
  else if (!agents.every((a) => agentShape.test(a))) errors.push(`${c.slice(0, 7)} ${subject}: Agent: trailer is not role@agenticcells.person or role@PrompTugal.dinis (${agents.join(', ')})`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAILED (${errors.length} of ${checked} commits checked)`);
  process.exit(1);
}
console.log(`OK (${checked} commits checked, ${added.length - checked} ancestors of the trusted base skipped)`);
