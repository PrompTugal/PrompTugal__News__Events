// Structural tests of where CI and release.sh take the security checks from (security@'s fourth ruling, Website 948820a7e):
// the anchor is GitHub's own record of the last passing deployment, never a tag; a missing anchor, an anchor that is not an
// ancestor, or a missing checker fails the run with no fallback. These read the workflow and release.sh as text: the shell
// they test runs only in CI and at release, so it is guarded here by shape. events.b@PrompTugal.dinis, 19 November 2026.
// Code: Apache-2.0.
import { readFileSync } from 'node:fs';

const wf = readFileSync('.github/workflows/pages.yml', 'utf8');
const rel = readFileSync('scripts/release.sh', 'utf8');
const step = (name) => { const i = wf.indexOf(`- name: ${name}`); if (i < 0) return ''; const j = wf.indexOf('\n      - ', i + 1); return wf.slice(i, j < 0 ? undefined : j); };
const trusted = step('The trailer and signature checks, from the last verified deployment, before any pushed-tree code runs');
const leak = step("Leak scan (tracked files and the built site; the anchor's scan, extracted and run in this step, clean environment)");
const cases = [
  ['the trusted step exists and reads the github-pages deployment record', () => /deployments\?environment=github-pages/.test(trusted) && /state.*success/s.test(trusted)],
  ['the build job may read deployments', () => /build:[\s\S]*?permissions:[\s\S]*?deployments: read/.test(wf)],
  ['no tag is used as a source of trust (no git describe, no tag lookups) in CI or release.sh', () => !/git describe|--tags|refs\/tags/.test(trusted + leak) && !/git describe|--points-at/.test(rel)],
  ['a missing anchor fails the run', () => /no successful github-pages deployment to anchor on[^\n]*exit 1/.test(trusted) && /no successful github-pages deployment to anchor on[^\n]*return 1/.test(rel)],
  ['an anchor that is not an ancestor fails the run', () => /merge-base --is-ancestor "\$A" "\$AFTER" \|\| \{[^}]*exit 1/.test(trusted) && /merge-base --is-ancestor "\$a" HEAD \|\| \{[^}]*return 1/.test(rel)],
  ['a missing checker in the anchor fails, with no fallback', () => /no copy of scripts\/\$f in the anchor[^\n]*exit 1/.test(trusted) && /no copy of the leak scan in the anchor[^\n]*exit 1/.test(leak) && /no copy of scripts\/\$f in the anchor[^\n]*return 1/.test(rel)],
  ['the checkers run from the anchor, under env -i, and the trailer range starts at the anchor', () => /git show "\$A:scripts\/\$f"/.test(trusted) && /env -i [^\n]*check-commits\.mjs" "\$A" "\$AFTER"/.test(trusted) && /env -i [^\n]*check-signatures\.mjs" "\$AFTER"/.test(trusted) && /env -i [^\n]*leak-scan\.mjs"/.test(leak)],
  ['the trusted checks run before any pushed-tree code (sync, build, tests)', () => { const i = wf.indexOf(trusted); return i > 0 && ['node scripts/test-check-signatures.mjs', 'node scripts/sync-data.mjs', 'node scripts/build.mjs'].every((c) => wf.indexOf(c) > i); }],
  ['a shallow checkout is refused before anything else in the trusted step', () => /is-shallow-repository[^\n]*exit 1/.test(trusted.split('\n').slice(0, 15).join('\n'))],
];
let failed = 0;
for (const [name, fn] of cases) { let ok = false; try { ok = fn(); } catch { } if (!ok) { failed++; console.error(`FAIL: ${name}`); } }
if (failed) { console.error(`workflow tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`workflow tests OK (${cases.length} cases)`);
