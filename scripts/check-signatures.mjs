// Signed commits (Dinis, 19 Nov 2026 ~01:05 UTC, Website board/guidance/2026-11-19-signed-commits-paid-search-and-free-embeds.md
// section 2; security@'s five controls, Website a250cc42). Every commit after the trusted base (below) must:
//   - carry a good git SSH signature by a key published in team/keys.json of its parent commit (of every parent, for a merge),
//     so a commit can never publish the key that signs it;
//   - name in its Agent: trailer the agent that key belongs to;
//   - carry in its Claude-Session: trailer the full session URL published with that key.
// Every commit in the range is checked, merges and side branches included (git rev-list, no --no-merges, no --first-parent).
// No commit is exempt by author, committer or any name: this repository's CI makes no commits (it pushes tags only), so
// nothing needs an exemption. One failure fails the whole range (exit 1), and CI deploys nothing from a failed build.
// Usage: node <trusted copy of check-signatures.mjs> [tip]   (default HEAD). CI and release.sh run the copy from the last
// release tag, never the pushed tree's, so a push cannot change the checker that checks it (videos.b@'s finding, 19 Nov 2026).
// Needs ssh-keygen. Prints OK or each failing commit.
// events.b@PrompTugal.dinis, 19 November 2026. Code: Apache-2.0.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const tryGit = (args) => { try { return git(args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

export const SSH_KEY = /^ssh-ed25519 [A-Za-z0-9+/]{68}$/;
export const SESSION = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]{20,40}$/;
export const AGENT = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+$/;

// The signing keys published in team/keys.json at one commit: entries with agent, session and ssh_signing.public_key, not superseded.
export function keysAt(rev, cwd) {
  const raw = (() => { try { return git(['show', `${rev}:team/keys.json`], { cwd }); } catch { return null; } })();
  if (!raw) return [];
  let d; try { d = JSON.parse(raw); } catch { return []; }
  return (Array.isArray(d?.keys) ? d.keys : []).filter((k) => k && !k.superseded && typeof k.agent === 'string' && AGENT.test(k.agent)
    && typeof k.session === 'string' && SESSION.test(k.session) && typeof k.ssh_signing?.public_key === 'string' && SSH_KEY.test(k.ssh_signing.public_key))
    .map((k) => ({ agent: k.agent, session: k.session, key: k.ssh_signing.public_key }));
}

// The trusted base: the commit that added this check (284a5ea, released as v0.1.49). Every checked tip must descend from it,
// so a pushed history of its own (an orphan root carrying its own keys) can never supply a base (videos.b@'s finding,
// via conductor.b@, 19 Nov 2026 14:01 UTC). Tests pass their own base.
export const TRUSTED_BASE = '284a5ea016a9e93ab10a639cd7be186ec7b2a843';

export function check(tip = 'HEAD', cwd = process.cwd(), { base: trusted = TRUSTED_BASE } = {}) {
  const failures = [];
  if (!tryGit(['-C', cwd, 'rev-parse', '--verify', '--quiet', `${tip}^{commit}`])) return { failures: [`${tip}: unknown commit`], checked: 0 };
  if (!/^[0-9a-f]{40}$/.test(trusted) || !tryGit(['-C', cwd, 'rev-parse', '--verify', '--quiet', `${trusted}^{commit}`])) return { failures: ['the trusted base is not in this repository'], checked: 0 };
  if (tryGit(['-C', cwd, 'merge-base', '--is-ancestor', trusted, tip]) === null) return { failures: [`${tip}: does not descend from the trusted base ${trusted.slice(0, 7)}`], checked: 0 };
  const base = trusted;
  // Every commit reachable from tip and not from base: the commits since the check began, side branches and merges included.
  const commits = lines(git(['rev-list', '--topo-order', `${base}..${tip}`], { cwd }));
  const dir = mkdtempSync(join(tmpdir(), 'sigs-'));
  try {
    for (const c of commits) {
      const short = c.slice(0, 7);
      const parents = git(['rev-list', '--parents', '-n', '1', c], { cwd }).split(' ').slice(1);
      // An orphan (no parent) could only trust keys in its own tree: refused, the trusted base aside (never in the range).
      if (!parents.length) { failures.push(`${short}: an orphan commit (no parent)`); continue; }
      // Keys valid for this commit: published in every parent.
      const sets = parents.map((p) => keysAt(p, cwd));
      const allowed = (sets[0] || []).filter((k) => sets.every((s) => s.some((x) => x.agent === k.agent && x.key === k.key && x.session === k.session)));
      if (!allowed.length) { failures.push(`${short}: no signing key is published in its parent's team/keys.json`); continue; }
      const signers = join(dir, 'allowed_signers');
      writeFileSync(signers, allowed.map((k) => `${k.agent} namespaces="git" ${k.key}`).join('\n') + '\n');
      const out = git(['-c', 'gpg.ssh.program=ssh-keygen', '-c', `gpg.ssh.allowedSignersFile=${signers}`, 'log', '-1',
        '--format=%G?%x00%GS%x00%(trailers:key=Agent,valueonly,separator=%x01)%x00%(trailers:key=Claude-Session,valueonly,separator=%x01)', c], { cwd });
      const [status, signer, agentT, sessionT] = out.split('\0');
      if (status === 'N') { failures.push(`${short}: unsigned`); continue; }
      // An SSH signature only (a PGP signature trusted on some machine must never pass).
      const raw = git(['cat-file', 'commit', c], { cwd });
      if (!/\ngpgsig -----BEGIN SSH SIGNATURE-----\n/.test('\n' + raw.split('\n\n')[0] + '\n')) { failures.push(`${short}: not an SSH signature`); continue; }
      if (status !== 'G') { failures.push(`${short}: not signed by a key published in its parent's team/keys.json (signature status ${status || '?'})`); continue; }
      const agents = (agentT || '').split('\x01').map((s) => s.trim()).filter(Boolean);
      const sessions = (sessionT || '').split('\x01').map((s) => s.trim()).filter(Boolean);
      if (agents.length !== 1) { failures.push(`${short}: needs exactly one Agent: trailer (has ${agents.length})`); continue; }
      if (agents[0] !== signer) { failures.push(`${short}: signed by ${signer}, but its Agent: trailer names ${agents[0]}`); continue; }
      const entry = allowed.find((k) => k.agent === signer);
      if (sessions.length !== 1 || sessions[0] !== entry.session) { failures.push(`${short}: its Claude-Session: trailer is not the session published with ${signer}'s key`); continue; }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return { failures, checked: commits.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // node check-signatures.mjs [tip] [--base=<sha>]: --base is for the tests' own repositories; CI and release.sh pass none.
  const args = process.argv.slice(2), opt = args.find((a) => a.startsWith('--base='));
  const { failures, checked } = check(args.find((a) => !a.startsWith('--')) || 'HEAD', process.cwd(), opt ? { base: opt.slice(7) } : {});
  if (failures.length) { console.error(failures.join('\n')); console.error(`signatures FAILED (${failures.length} of ${checked} commits)`); process.exit(1); }
  console.log(`signatures OK (${checked} commits since the check began)`);
}
