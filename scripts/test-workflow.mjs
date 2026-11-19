// Structural tests of where CI and release.sh take the security checks from (security@'s fourth to sixth rulings, Website
// 948820a7e, 16402a95c, 0ba439611): the anchor is the head commit of this workflow's latest successful push run on dev, never a tag; a missing anchor, an
// anchor that is not an ancestor, or a missing checker fails with no fallback; and (control 9) the checks run in their own job
// that runs no code from the pushed tree, which deploy needs, so nothing a pushed build step writes (GITHUB_ENV, files) can
// change their result. These read the workflow and release.sh as text: that shell runs only in CI and at release, so it is
// guarded here by shape. events.b@PrompTugal.dinis, 19 November 2026. Code: Apache-2.0.
import { readFileSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Comments are removed first, so no test can be satisfied by a comment that merely mentions a step (library.b@'s
// LIB-2026-067): whole comment lines, and a trailing " # ..." after code.
const strip = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/\s+#.*$/, '')).join('\n');
const wf = strip(readFileSync('.github/workflows/pages.yml', 'utf8'));
const rel = strip(readFileSync('scripts/release.sh', 'utf8'));
const job = (name) => { const i = wf.indexOf(`\n  ${name}:\n`); if (i < 0) return ''; const rest = wf.slice(i + 1); const m = rest.slice(1).search(/\n  [a-z][a-z0-9_-]*:\n/); return m < 0 ? rest : rest.slice(0, m + 1); };
const verify = job('verify'), build = job('build'), deploy = job('deploy'), tag = job('tag');
const cases = [
  ['comments are not counted: a check present only in a comment is not found', () => !strip('      # node "$T/check-signatures.mjs" "$AFTER"\n      run: true  # needs: [build, verify]\n').includes('check-signatures') && !strip('x  # needs: [build, verify]').includes('needs') && !strip('run: true #check-signatures.mjs').includes('check-signatures')],
  ['a verify job exists and anchors on the latest successful push run of this workflow on dev (actions: read)', () => /actions\/workflows\/pages\.yml\/runs\?branch=dev&event=push&status=success/.test(verify) && /\.path == "\.github\/workflows\/pages\.yml" and \.head_branch == "dev" and \.event == "push" and \.conclusion == "success"/.test(verify) && /permissions:[\s\S]*?actions: read/.test(verify) && !/deployments\?environment/.test(verify)],
  ['the verify job runs no code from the pushed tree (no node, npm or bash of a repository script)', () => verify && !/(node|npm|npx|bash|sh)\s+(\.\/)?scripts\//.test(verify) && !/run: \.\//.test(verify)],
  ['the verify job takes the build output only as the Pages artifact, as data', () => /actions\/download-artifact@[0-9a-f]{40}/.test(verify) && /name: github-pages/.test(verify) && /tar -xf/.test(verify)],
  ['a pushed build step cannot change the checks: they are not in the build job, and deploy and tag need verify', () => !/check-signatures\.mjs"|check-commits\.mjs"|"\$T\/leak-scan/.test(build) && /needs: \[build, verify\]/.test(deploy) && /needs: \[build, verify, deploy\]/.test(tag) && /needs\.verify\.result == 'success'/.test(tag)],
  ['no tag is used as a source of trust in CI or release.sh', () => !/git describe|--tags|refs\/tags/.test(verify) && !/git describe|--points-at/.test(rel)],
  ['a missing anchor fails the run', () => /no successful push run of this workflow on dev to anchor on[^\n]*exit 1/.test(verify) && /no successful push run of this workflow on dev to anchor on[^\n]*return 1/.test(rel)],
  ['an anchor that is not an ancestor fails the run', () => /merge-base --is-ancestor "\$A" "\$AFTER" \|\| \{[^}]*exit 1/.test(verify) && /merge-base --is-ancestor "\$a" HEAD \|\| \{[^}]*return 1/.test(rel)],
  ['a missing or non-regular checker in the anchor fails, with no fallback (symlinks refused)', () => /git ls-tree "\$A" "scripts\/\$f"/.test(verify) && /\[ "\$mode" = "100644" \] \|\| \[ "\$mode" = "100755" \] \|\| \{ echo "no regular-file copy[^\n]*exit 1/.test(verify) && /no copy of scripts\/\$f in the anchor[^\n]*return 1/.test(rel)],
  ['the checkers run from the anchor, with an absolute node, under env -i and GIT_NO_REPLACE_OBJECTS, range A..AFTER', () => /git show "\$A:scripts\/\$f"/.test(verify) && /NODE=\$\(command -v node\); case "\$NODE" in \/\*\)/.test(verify) && /GIT_NO_REPLACE_OBJECTS: '1'/.test(verify) && (verify.match(/env -i PATH="\$PATH" HOME="\$HOME" GIT_NO_REPLACE_OBJECTS=1 GIT_ATTR_SOURCE="\$GIT_ATTR_SOURCE" "\$NODE" "\$T\//g) || []).length === 3 && /check-commits\.mjs" "\$A" "\$AFTER"/.test(verify)],
  ['a shallow checkout and a symlink in the built site are refused', () => /is-shallow-repository[^\n]*exit 1/.test(verify) && /find _site -type l[^\n]*exit 1/.test(verify)],
  ['the built site is listed and vetted before unpacking, and unpacked before the trusted copies exist, which are then read-only', () => {
    const list = verify.indexOf("tar -tvf"), x = verify.indexOf('tar -xf'), t = verify.indexOf('T="$RUNNER_TEMP/trusted"'), w = verify.indexOf('git show "$A:scripts/$f"'), ro = verify.indexOf('chmod -R a-w "$T"');
    return list > 0 && /grep -qv '\^\[-d\]\$'[^\n]*exit 1/.test(verify) && /\(\^\/\|[^\n]*exit 1/.test(verify) && list < x && x < t && t < w && w < ro && /--no-overwrite-dir/.test(verify);
  }],
  // live.b@'s a4c6fce (via conductor.b@, 19 Nov 2026 16:15 UTC)
  ['a pushed _site path is refused before the artifact is downloaded, into RUNNER_TEMP', () => {
    const r = verify.indexOf('git ls-tree "$AFTER" _site'), d = verify.indexOf('actions/download-artifact@');
    return r > 0 && d > r && /git ls-tree "\$AFTER" _site\)" \] \|\| \[ -e _site \] \|\| \[ -L _site \]; then [^\n]*exit 1/.test(verify) && /path: \$\{\{ runner\.temp \}\}\/site-artifact/.test(verify);
  }],
  ['pushed .gitattributes are off for every git command in verify (GIT_ATTR_SOURCE = the empty tree, git 2.42 or later)', () => /\n    env:\n(      [^\n]*\n)*      GIT_ATTR_SOURCE: 4b825dc642cb6eb9a060e54bf8d69288fbee4904\n/.test(verify) && (verify.match(/GIT_ATTR_SOURCE="\$GIT_ATTR_SOURCE" "\$NODE"/g) || []).length === 3 && /ignores GIT_ATTR_SOURCE: refused[^\n]*exit 1/.test(verify) && /\(\( ma < 2 \|\| \(ma == 2 && mi < 42\) \)\)/.test(verify) && !/-lt 42/.test(verify)],
  ['A is a run in which the job named verify passed, read from the run\'s jobs; an API error fails', () => /actions\/runs\/\$\{row%%:\*\}\/jobs/.test(verify) && /select\(\.name == "verify" and \.conclusion == "success"\)/.test(verify) && /cannot read a run's jobs[^\n]*exit 1/.test(verify) && /if \[ "\$v" = "1" \]; then A="\$\{row##\*:\}"; break; fi/.test(verify) && /\|\| \{ echo "cannot read this workflow's runs" >&2; exit 1; \}/.test(verify)],
  ['release.sh anchors on a run whose verify job passed, and falls back to version.json only on a rate limit (403 or 429)', () => /\/runs\/" \+ r\.id \+ "\/jobs/.test(rel) && /x\.name === "verify" && x\.conclusion === "success"/.test(rel) && /\.catch\(\(e\) => \(e\.status === 403 \|\| e\.status === 429\) \? fetch\("https:\/\/events\.promptugal\.news\/version\.json"/.test(rel) && /: process\.exit\(1\)\)/.test(rel)],
  ['the git version gate, run under bash -e -o pipefail, passes 2.42 or later and refuses older or unreadable versions (fails closed)', () => {
    const raw = readFileSync('.github/workflows/pages.yml', 'utf8').split('\n');
    const i = raw.findIndex((l) => /^\s*gv=\$\(git version\)/.test(l)), j = raw.findIndex((l) => /ignores GIT_ATTR_SOURCE: refused/.test(l));
    if (i < 0 || j < i) return false;
    const gate = raw.slice(i, j + 1).map((l) => l.trim()).join('\n');
    const run = (v) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `git() { printf '%s\\n' "$FAKE"; }\n${gate}\necho PASS`], { env: { PATH: process.env.PATH, FAKE: v }, encoding: 'utf8' }).stdout.includes('PASS');
    const pass = ['git version 2.42', 'git version 2.42.0', 'git version 2.43.0.windows.1', 'git version 3.0.1'];
    const refuse = ['git version 2.41.9', 'git version 1.99', 'git version 2.39.5 (Apple Git-154)', 'git version 08.1.0', 'git version 2.08.0', 'git version 2.042.0',
      'git version 2.18446744073709551700.0', 'git version x.y', 'git version 2.43-rc1', 'git version 2.42rc', ''];
    return pass.every(run) && !refuse.some(run);
  }],
  // security@'s control 10 (Website ed70bd996): the block in the verify job, run in throwaway repositories.
  ['control 10: a pushed symlink fails, one listed in A passes, one listed only in the pushed tree fails, one added and removed fails', () => {
    const raw = readFileSync('.github/workflows/pages.yml', 'utf8').split('\n');
    const i = raw.findIndex((l) => /# control-10 begin/.test(l)), j = raw.findIndex((l) => /# control-10 end/.test(l));
    if (i < 0 || j < i) return false;
    const block = raw.slice(i, j + 1).map((l) => l.replace(/^ {10}/, '')).join('\n');
    const run = (setup) => {
      const r = mkdtempSync(join(tmpdir(), 'ctl10-')), tmp = mkdtempSync(join(tmpdir(), 'ctl10t-'));
      const g = (...a) => execFileSync('git', ['-C', r, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { stdio: 'pipe' }).toString().trim();
      g('init', '-q'); writeFileSync(join(r, 'f'), 'x\n'); g('add', '-A'); g('commit', '-qm', 'base');
      const A = setup(r, g) || g('rev-parse', 'HEAD~1');
      const out = spawnSync('bash', ['-e', '-c', block + '\necho PASS'], { cwd: r, env: { PATH: process.env.PATH, HOME: tmp, A, AFTER: g('rev-parse', 'HEAD'), RUNNER_TEMP: tmp }, encoding: 'utf8' });
      rmSync(r, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true });
      return out.stdout.includes('PASS') ? 'PASS' : out.stderr;
    };
    const commit = (g, m) => { g('add', '-A'); g('commit', '-qm', m); };
    const exc = (r, line) => { mkdirSync(join(r, '.github'), { recursive: true }); writeFileSync(join(r, '.github/symlink-exceptions.txt'), `# path<TAB>reason\n${line}\n`); };
    const pushed = run((r, g) => { symlinkSync('f', join(r, 'link')); commit(g, 'link'); });
    const listed = run((r, g) => { exc(r, 'link\tneeded by the test'); commit(g, 'exceptions'); const A = g('rev-parse', 'HEAD'); symlinkSync('f', join(r, 'link')); commit(g, 'link'); return A; });
    const onlyPushed = run((r, g) => { exc(r, 'link\tlisted in the push itself'); symlinkSync('f', join(r, 'link')); commit(g, 'link and its exception'); });
    const noReason = run((r, g) => { exc(r, 'link'); commit(g, 'exceptions'); const A = g('rev-parse', 'HEAD'); symlinkSync('f', join(r, 'link')); commit(g, 'link'); return A; });
    const addRemove = run((r, g) => { const A = g('rev-parse', 'HEAD'); symlinkSync('f', join(r, 'link')); commit(g, 'add'); rmSync(join(r, 'link')); commit(g, 'remove'); return A; });
    const untracked = run((r, g) => { writeFileSync(join(r, 'g'), 'y\n'); commit(g, 'plain'); symlinkSync('/etc/hostname', join(r, 'stray')); });
    const merged = run((r, g) => { const A = g('rev-parse', 'HEAD'); g('checkout', '-qb', 'side'); symlinkSync('f', join(r, 'link')); commit(g, 'side link'); g('checkout', '-q', '-'); writeFileSync(join(r, 'h'), 'z\n'); commit(g, 'main'); g('merge', '-q', '--no-ff', '-m', 'merge', 'side'); g('rm', '-q', 'link'); commit(g, 'drop'); return A; });
    // a symlink that only the merge commit itself brings in (seen only with diff-tree -m)
    const evilMerge = run((r, g) => { const A = g('rev-parse', 'HEAD'); g('checkout', '-qb', 'side'); writeFileSync(join(r, 's'), 's\n'); commit(g, 'side'); g('checkout', '-q', '-'); writeFileSync(join(r, 'h'), 'z\n'); commit(g, 'main'); g('merge', '-q', '--no-ff', '--no-commit', 'side'); symlinkSync('f', join(r, 'link')); g('add', '-A'); g('commit', '-qm', 'merge'); g('rm', '-q', 'link'); commit(g, 'drop'); return A; });
    const blankReason = run((r, g) => { exc(r, 'link\t   '); commit(g, 'exceptions'); const A = g('rev-parse', 'HEAD'); symlinkSync('f', join(r, 'link')); commit(g, 'link'); return A; });
    const clean = run((r, g) => { writeFileSync(join(r, 'g'), 'y\n'); commit(g, 'plain'); });
    // a newline in a link's name must not match a listed path (AppSec review, 19 Nov 2026)
    const newline = run((r, g) => { exc(r, 'docs\tlisted'); commit(g, 'exceptions'); const A = g('rev-parse', 'HEAD'); symlinkSync('f', join(r, 'docs\nevil')); commit(g, 'newline link'); return A; });
    const refused = (x, why) => x !== 'PASS' && x.includes(why) && x.includes('symbolic links refused (control 10)');
    const link = 'adds or changes a symbolic link: ';
    const ok = refused(pushed, link + 'link') && listed === 'PASS' && refused(onlyPushed, link + 'link') && /needs a path, a tab and a reason: refused/.test(noReason) && /needs a path, a tab and a reason: refused/.test(blankReason)
      && refused(addRemove, link + 'link') && refused(untracked, 'in the checked-out tree: stray') && refused(merged, link + 'link') && refused(evilMerge, link + 'link') && refused(newline, link + 'docs\nevil') && clean === 'PASS';
    if (!ok) console.error('  control 10:', JSON.stringify({ pushed, listed, onlyPushed, noReason, addRemove, untracked, merged, evilMerge, blankReason, newline, clean }));
    return ok;
  }],
  ['verify, deploy and tag run only for refs/heads/dev', () => [verify, deploy, tag].every((j) => /\n    if: [^\n]*github\.ref == 'refs\/heads\/dev'/.test(j))],
];
let failed = 0;
for (const [name, fn] of cases) { let ok = false; try { ok = fn(); } catch { } if (!ok) { failed++; console.error(`FAIL: ${name}`); } }
if (failed) { console.error(`workflow tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`workflow tests OK (${cases.length} cases)`);
