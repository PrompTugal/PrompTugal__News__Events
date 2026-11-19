// Structural tests of where CI and release.sh take the security checks from (security@'s fourth to sixth rulings, Website
// 948820a7e, 16402a95c, 0ba439611): the anchor is the head commit of this workflow's latest successful push run on dev, never a tag; a missing anchor, an
// anchor that is not an ancestor, or a missing checker fails with no fallback; and (control 9) the checks run in their own job
// that runs no code from the pushed tree, which deploy needs, so nothing a pushed build step writes (GITHUB_ENV, files) can
// change their result. These read the workflow and release.sh as text: that shell runs only in CI and at release, so it is
// guarded here by shape. events.b@PrompTugal.dinis, 19 November 2026. Code: Apache-2.0.
import { readFileSync } from 'node:fs';

const wf = readFileSync('.github/workflows/pages.yml', 'utf8');
const rel = readFileSync('scripts/release.sh', 'utf8');
const job = (name) => { const i = wf.indexOf(`\n  ${name}:\n`); if (i < 0) return ''; const rest = wf.slice(i + 1); const m = rest.slice(1).search(/\n  [a-z][a-z0-9_-]*:\n/); return m < 0 ? rest : rest.slice(0, m + 1); };
const verify = job('verify'), build = job('build'), deploy = job('deploy'), tag = job('tag');
const cases = [
  ['a verify job exists and anchors on the latest successful push run of this workflow on dev (actions: read)', () => /actions\/workflows\/pages\.yml\/runs\?branch=dev&event=push&status=success/.test(verify) && /\.path == "\.github\/workflows\/pages\.yml" and \.head_branch == "dev" and \.event == "push" and \.conclusion == "success"/.test(verify) && /permissions:[\s\S]*?actions: read/.test(verify) && !/deployments\?environment/.test(verify)],
  ['the verify job runs no code from the pushed tree (no node, npm or bash of a repository script)', () => verify && !/(node|npm|npx|bash|sh)\s+(\.\/)?scripts\//.test(verify) && !/run: \.\//.test(verify)],
  ['the verify job takes the build output only as the Pages artifact, as data', () => /actions\/download-artifact@[0-9a-f]{40}/.test(verify) && /name: github-pages/.test(verify) && /tar -xf/.test(verify)],
  ['a pushed build step cannot change the checks: they are not in the build job, and deploy and tag need verify', () => !/check-signatures\.mjs"|check-commits\.mjs"|"\$T\/leak-scan/.test(build) && /needs: \[build, verify\]/.test(deploy) && /needs: \[build, verify, deploy\]/.test(tag) && /needs\.verify\.result == 'success'/.test(tag)],
  ['no tag is used as a source of trust in CI or release.sh', () => !/git describe|--tags|refs\/tags/.test(verify) && !/git describe|--points-at/.test(rel)],
  ['a missing anchor fails the run', () => /no successful push run of this workflow on dev to anchor on[^\n]*exit 1/.test(verify) && /no successful push run of this workflow on dev to anchor on[^\n]*return 1/.test(rel)],
  ['an anchor that is not an ancestor fails the run', () => /merge-base --is-ancestor "\$A" "\$AFTER" \|\| \{[^}]*exit 1/.test(verify) && /merge-base --is-ancestor "\$a" HEAD \|\| \{[^}]*return 1/.test(rel)],
  ['a missing or non-regular checker in the anchor fails, with no fallback (symlinks refused)', () => /git ls-tree "\$A" "scripts\/\$f"/.test(verify) && /\[ "\$mode" = "100644" \] \|\| \[ "\$mode" = "100755" \] \|\| \{ echo "no regular-file copy[^\n]*exit 1/.test(verify) && /no copy of scripts\/\$f in the anchor[^\n]*return 1/.test(rel)],
  ['the checkers run from the anchor, with an absolute node, under env -i and GIT_NO_REPLACE_OBJECTS, range A..AFTER', () => /git show "\$A:scripts\/\$f"/.test(verify) && /NODE=\$\(command -v node\); case "\$NODE" in \/\*\)/.test(verify) && /GIT_NO_REPLACE_OBJECTS: '1'/.test(verify) && (verify.match(/env -i PATH="\$PATH" HOME="\$HOME" GIT_NO_REPLACE_OBJECTS=1 "\$NODE" "\$T\//g) || []).length === 3 && /check-commits\.mjs" "\$A" "\$AFTER"/.test(verify)],
  ['a shallow checkout and a symlink in the built site are refused', () => /is-shallow-repository[^\n]*exit 1/.test(verify) && /find _site -type l[^\n]*exit 1/.test(verify)],
  ['the built site is listed and vetted before unpacking, and unpacked before the trusted copies exist, which are then read-only', () => {
    const list = verify.indexOf("tar -tvf"), x = verify.indexOf('tar -xf'), t = verify.indexOf('T="$RUNNER_TEMP/trusted"'), w = verify.indexOf('git show "$A:scripts/$f"'), ro = verify.indexOf('chmod -R a-w "$T"');
    return list > 0 && /grep -qv '\^\[-d\]\$'[^\n]*exit 1/.test(verify) && /\(\^\/\|[^\n]*exit 1/.test(verify) && list < x && x < t && t < w && w < ro && /--no-overwrite-dir/.test(verify);
  }],
];
let failed = 0;
for (const [name, fn] of cases) { let ok = false; try { ok = fn(); } catch { } if (!ok) { failed++; console.error(`FAIL: ${name}`); } }
if (failed) { console.error(`workflow tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`workflow tests OK (${cases.length} cases)`);
