// Tests for scripts/check-signatures.mjs, run before the check in release.sh and in CI. Each case builds a throwaway repository
// with its own throwaway keys and asserts not only that a bad commit fails but why (conductor.b@, 19 Nov 2026, from data.b@'s
// f68beb3). Each test repository sets gpg.ssh.program=ssh-keygen and commit.gpgsign locally: the environment's global config
// points git at its own signer, which would make signed cases fail, or bad ones fail for the wrong reason. Needs ssh-keygen.
// events.b@PrompTugal.dinis, 19 November 2026. Code: Apache-2.0.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './check-signatures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sigtest-'));
const SESSION_A = 'https://claude.ai/code/session_01TestAAAAAAAAAAAAAAAAAAAA';
const SESSION_B = 'https://claude.ai/code/session_01TestBBBBBBBBBBBBBBBBBBBB';
const AGENT_A = 'events.b@PrompTugal.dinis', AGENT_B = 'other.b@PrompTugal.dinis';

function key(name) {
  const f = join(root, name);
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', '', '-f', f]);
  return { priv: f, pub: readFileSync(f + '.pub', 'utf8').trim().split(' ').slice(0, 2).join(' ') };
}
const KA = key('a'), KB = key('b');

function repo(name) {
  const r = join(root, name); mkdirSync(join(r, 'scripts'), { recursive: true }); mkdirSync(join(r, 'team'));
  const g = (...a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-q', '-b', 'dev');
  for (const [k, v] of [['user.name', 'test'], ['user.email', 'test@example.invalid'], ['gpg.format', 'ssh'], ['gpg.ssh.program', 'ssh-keygen'], ['commit.gpgsign', 'false']]) g('config', k, v);
  const keys = (entries) => writeFileSync(join(r, 'team/keys.json'), JSON.stringify({ keys: entries }, null, 1));
  const commit = (msg, { signer, agent = AGENT_A, session = SESSION_A, file = 'f.txt' } = {}) => {
    writeFileSync(join(r, file), msg + Math.random());
    g('add', '-A');
    const trailers = [agent ? `Agent: ${agent}` : '', session ? `Claude-Session: ${session}` : ''].filter(Boolean).join('\n');
    const args = signer ? ['-c', 'commit.gpgsign=true', '-c', `user.signingkey=${signer.priv}`] : [];
    g(...args, 'commit', '-q', '-m', `${msg}\n\n${trailers}`);
    return g('rev-parse', 'HEAD');
  };
  // history before the check: one plain commit
  commit('before the check'); g('tag', 'pre');
  // the base commit: adds the check and publishes key A for agent A
  copyFileSync(join(here, 'check-signatures.mjs'), join(r, 'scripts/check-signatures.mjs'));
  keys([{ agent: AGENT_A, session: SESSION_A, ssh_signing: { public_key: KA.pub } }]);
  const base = commit('base', { signer: KA });
  return { r, g, keys, commit, base };
}

const cases = [];
const t = (name, fn, expect) => cases.push({ name, fn, expect });

t('a commit signed by the published key, with matching trailers, passes', (x) => { x.commit('ok', { signer: KA }); }, null);
t('an unsigned commit fails as unsigned', (x) => { x.commit('u'); }, /: unsigned$/);
t('a commit signed by an unpublished key fails', (x) => { x.commit('k', { signer: KB }); }, /not signed by a key published/);
t('an Agent: trailer naming someone else fails', (x) => { x.commit('a', { signer: KA, agent: AGENT_B }); }, /but its Agent: trailer names/);
t('a missing Agent: trailer fails', (x) => { x.commit('m', { signer: KA, agent: '' }); }, /exactly one Agent: trailer/);
t('a Claude-Session: other than the published one fails', (x) => { x.commit('s', { signer: KA, session: SESSION_B }); }, /Claude-Session: trailer is not the session published/);
t('a commit that publishes the key that signs it fails (keys come from the parent)', (x) => {
  x.keys([{ agent: AGENT_A, session: SESSION_A, ssh_signing: { public_key: KA.pub } }, { agent: AGENT_B, session: SESSION_B, ssh_signing: { public_key: KB.pub } }]);
  x.commit('self', { signer: KB, agent: AGENT_B, session: SESSION_B });
}, /not signed by a key published/);
t('a key published in an earlier commit signs later commits', (x) => {
  x.keys([{ agent: AGENT_A, session: SESSION_A, ssh_signing: { public_key: KA.pub } }, { agent: AGENT_B, session: SESSION_B, ssh_signing: { public_key: KB.pub } }]);
  x.commit('publish B', { signer: KA });
  x.commit('by B', { signer: KB, agent: AGENT_B, session: SESSION_B });
}, null);
t('a superseded key no longer signs', (x) => {
  x.keys([{ agent: AGENT_A, session: SESSION_A, superseded: '2026-11-19T00:00Z', ssh_signing: { public_key: KA.pub } }, { agent: AGENT_B, session: SESSION_B, ssh_signing: { public_key: KB.pub } }]);
  x.commit('retire A', { signer: KA });
  x.commit('by A again', { signer: KA });
}, /no signing key is published|not signed by a key published/);
t('an unsigned commit on a merged side branch fails', (x) => {
  x.g('checkout', '-q', '-b', 'side'); x.commit('side unsigned', { file: 's.txt' });
  x.g('checkout', '-q', 'dev'); x.commit('main ok', { signer: KA });
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'merge', '-q', '--no-ff', 'side', '-m', `merge\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
}, /: unsigned$/);
t('an unsigned merge commit fails', (x) => {
  x.g('checkout', '-q', '-b', 'side'); x.commit('side ok', { signer: KA, file: 's.txt' });
  x.g('checkout', '-q', 'dev'); x.commit('main ok', { signer: KA });
  x.g('merge', '-q', '--no-ff', 'side', '-m', `merge\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
}, /: unsigned$/);
t('a merge signed by a key published on only one side fails (keys from every parent)', (x) => {
  // B is published on the first-parent side only; the merged side branch never had it
  x.g('checkout', '-q', '-b', 'side'); x.commit('side ok', { signer: KA, file: 's.txt' });
  x.g('checkout', '-q', 'dev');
  x.keys([{ agent: AGENT_A, session: SESSION_A, ssh_signing: { public_key: KA.pub } }, { agent: AGENT_B, session: SESSION_B, ssh_signing: { public_key: KB.pub } }]);
  x.commit('publish B on dev', { signer: KA });
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KB.priv}`, 'merge', '-q', '--no-ff', 'side', '-m', `merge\n\nAgent: ${AGENT_B}\nClaude-Session: ${SESSION_B}`);
}, /not signed by a key published/);
t('an old-dated side branch that adds the check again cannot move the base (commit order, not dates)', (x) => {
  x.g('checkout', '-q', '-b', 'side', 'pre');
  x.commit('unsigned before', { file: 'z.txt' });
  mkdirSync(join(x.r, 'scripts'), { recursive: true }); mkdirSync(join(x.r, 'team'), { recursive: true });
  copyFileSync(join(here, 'check-signatures.mjs'), join(x.r, 'scripts/check-signatures.mjs'));
  x.keys([{ agent: AGENT_A, session: SESSION_A, ssh_signing: { public_key: KA.pub } }]);
  execFileSync('git', ['-C', x.r, 'add', '-A']);
  execFileSync('git', ['-C', x.r, 'commit', '-q', '-m', `re-add\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`], { env: { ...process.env, GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z' } });
  x.g('checkout', '-q', 'dev');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'merge', '-q', '--no-ff', '-X', 'theirs', 'side', '-m', `merge\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
}, /no signing key is published|: unsigned$/);
t('deleting the check, an unsigned commit, then an old-dated re-add cannot move the base', (x) => {
  x.g('rm', '-q', 'scripts/check-signatures.mjs');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'commit', '-q', '-m', `remove\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
  x.commit('unsigned in between', { file: 'y.txt' });
  mkdirSync(join(x.r, 'scripts'), { recursive: true });
  copyFileSync(join(here, 'check-signatures.mjs'), join(x.r, 'scripts/check-signatures.mjs'));
  execFileSync('git', ['-C', x.r, 'add', '-A']);
  execFileSync('git', ['-C', x.r, '-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'commit', '-q', '-m', `re-add\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`], { env: { ...process.env, GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z' } });
}, /: unsigned$/);
t('an orphan commit merged in fails as an orphan', (x) => {
  x.g('checkout', '-q', '--orphan', 'loose'); x.g('rm', '-rq', '--cached', '.');
  writeFileSync(join(x.r, 'o.txt'), 'o'); x.g('add', 'o.txt');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'commit', '-q', '-m', `orphan\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
  x.g('checkout', '-q', '-f', 'dev');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'merge', '-q', '--no-ff', '--allow-unrelated-histories', 'loose', '-m', `merge\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
}, /an orphan commit/);
t('an orphan signed with its own key, carrying that key in its own tree, fails when merged in', (x) => {
  x.g('checkout', '-q', '--orphan', 'own'); x.g('rm', '-rq', '--cached', '.');
  writeFileSync(join(x.r, 'team/keys.json'), JSON.stringify({ keys: [{ agent: AGENT_B, session: SESSION_B, ssh_signing: { public_key: KB.pub } }] }));
  x.g('add', 'team/keys.json');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KB.priv}`, 'commit', '-q', '-m', `own keys\n\nAgent: ${AGENT_B}\nClaude-Session: ${SESSION_B}`);
  x.g('checkout', '-q', '-f', 'dev');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'merge', '-q', '--no-ff', '--allow-unrelated-histories', '-X', 'ours', 'own', '-m', `merge\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
}, /an orphan commit/);
t('a new history that does not descend from the trusted base fails', (x) => {
  x.g('checkout', '-q', '--orphan', 'fresh');
  x.g('-c', 'commit.gpgsign=true', '-c', `user.signingkey=${KA.priv}`, 'commit', '-q', '-m', `fresh root with its own keys\n\nAgent: ${AGENT_A}\nClaude-Session: ${SESSION_A}`);
}, /does not descend from the trusted base/);
t('a commit that removes the checker and adds an unsigned change fails (skips by ancestry, never by tree)', (x) => {
  x.g('rm', '-q', 'scripts/check-signatures.mjs');
  x.commit('remove the checker, unsigned');
}, /: unsigned$/);
t('one bad commit among good ones fails the whole range', (x) => { x.commit('g1', { signer: KA }); x.commit('bad'); x.commit('g2', { signer: KA }); }, /: unsigned$/);

// The checker is run from the trusted copy, never the pushed tree's: a push that replaces it with one that always passes,
// plus an unsigned commit, still fails when the release's copy is run (videos.b@'s finding).
cases.push({ name: 'a pushed checker that always passes cannot check itself: the trusted copy still fails the push', fn: (x) => {
  writeFileSync(join(x.r, 'scripts/check-signatures.mjs'), "console.log('signatures OK'); process.exit(0)\n");
  x.commit('weaken the checker');
  const trusted = join(root, 'trusted-check.mjs');
  writeFileSync(trusted, execFileSync('git', ['-C', x.r, 'show', `${x.base}:scripts/check-signatures.mjs`]));
  const pushed = (() => { try { execFileSync('node', [join(x.r, 'scripts/check-signatures.mjs')], { cwd: x.r, stdio: 'pipe' }); return 'passes'; } catch { return 'fails'; } })();
  let out = '';
  const noCI = { ...process.env }; delete noCI.CI; delete noCI.GITHUB_ACTIONS;
  try { execFileSync('node', [trusted, 'HEAD', `--base=${x.base}`], { cwd: x.r, stdio: 'pipe', env: noCI }); out = '(passed)'; } catch (e) { out = String(e.stderr); }
  x.result = pushed === 'passes' && /: unsigned/.test(out) ? [] : [`pushed copy ${pushed}; trusted copy: ${out.trim()}`];
}, expect: 'custom' });
cases.push({ name: 'under CI, --base cannot override the pinned base', fn: (x) => {
  x.commit('ok', { signer: KA });
  let out = '';
  try { execFileSync('node', [join(here, 'check-signatures.mjs'), 'HEAD', `--base=${x.base}`], { cwd: x.r, stdio: 'pipe', env: { ...process.env, CI: 'true' } }); out = '(passed)'; } catch (e) { out = String(e.stderr); }
  x.result = /--base is refused under CI/.test(out) ? [] : [`got: ${out.trim()}`];
}, expect: 'custom' });
cases.push({ name: 'a shallow checkout is refused', fn: (x) => {
  x.commit('ok', { signer: KA });
  const shallow = join(root, `shallow${Math.random().toString(36).slice(2, 8)}`);
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${x.r}`, shallow], { stdio: 'pipe' });
  const { failures } = check('HEAD', shallow, { base: x.base });
  x.result = failures.some((f) => /a shallow checkout/.test(f)) ? [] : [`got: ${failures.join(' | ') || '(passed)'}`];
}, expect: 'custom' });
let failed = 0, i = 0;
try {
  for (const c of cases) {
    const x = repo(`case${i++}`);
    c.fn(x);
    const { failures } = c.expect === 'custom' ? { failures: x.result } : check('HEAD', x.r, { base: x.base });
    const ok = c.expect === 'custom' ? failures.length === 0 : c.expect === null ? failures.length === 0 : failures.length > 0 && failures.some((f) => c.expect.test(f));
    if (!ok) { failed++; console.error(`FAIL: ${c.name}\n  got: ${failures.join(' | ') || '(passed)'}`); }
  }
} finally { rmSync(root, { recursive: true, force: true }); }
if (failed) { console.error(`signature tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`signature tests OK (${cases.length} cases)`);
