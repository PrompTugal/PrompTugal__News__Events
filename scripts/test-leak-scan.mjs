// Tests for the leak scan's key rules (security@, Website 312c4601 and 1acd10498: a test for each rule). Key-shaped strings
// are built here at run time from parts, so this file holds none and does not trip the scan it tests.
// events.b@PrompTugal.dinis, 19 November 2026. Code: Apache-2.0.
import { randomBytes } from 'node:crypto';
import { scanText } from './leak-scan.mjs';

const D = '-'.repeat(5);
const b64 = (n) => randomBytes(n).toString('base64');
// an ed25519 public key's base64 is 68 characters: the 51-byte wire form
const ed = () => 'ssh-' + 'ed25519 ' + ('AAAAC3NzaC1lZDI1NTE5AAAAI' + b64(48)).slice(0, 68);
const others = {
  'ssh-rsa': () => 'ssh-' + 'rsa AAAAB3NzaC1yc2E' + b64(200).replace(/=/g, ''),
  'ssh-dss': () => 'ssh-' + 'dss AAAAB3NzaC1kc3M' + b64(300).replace(/=/g, ''),
  'ecdsa-sha2-nistp256': () => 'ecdsa-' + 'sha2-nistp256 AAAAE2VjZHNh' + b64(90).replace(/=/g, ''),
  'ecdsa-sha2-nistp384': () => 'ecdsa-' + 'sha2-nistp384 AAAAE2VjZHNh' + b64(110).replace(/=/g, ''),
  'ecdsa-sha2-nistp521': () => 'ecdsa-' + 'sha2-nistp521 AAAAE2VjZHNh' + b64(140).replace(/=/g, ''),
  'sk-ssh-ed25519': () => 'sk-' + 'ssh-ed25519@openssh.com AAAAGnNrLXNzaC1l' + b64(60).replace(/=/g, ''),
  'sk-ecdsa-sha2-nistp256': () => 'sk-' + 'ecdsa-sha2-nistp256@openssh.com AAAAInNrLWVj' + b64(100).replace(/=/g, ''),
};
const keysFile = (entries) => JSON.stringify({ keys: entries }, null, 1);
const has = (found, kind) => found.some((f) => f.kind === kind);

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

for (const h of ['', 'OPENSSH ', 'RSA ', 'EC ', 'DSA ', 'ENCRYPTED ']) {
  const header = `${D}BEGIN ${h}PRIVATE KEY${D}`;
  t(`a ${h || 'PKCS#8 '}PRIVATE KEY header fails in an ordinary file`, () => has(scanText('docs/x.md', `x\n${header}\n`), 'private key block'));
  t(`a ${h || 'PKCS#8 '}PRIVATE KEY header fails even in team/keys.json`, () => has(scanText('team/keys.json', `${header}\n`), 'private key block'));
  t(`a ${h || 'PKCS#8 '}PRIVATE KEY header fails even in an allowed file`, () => has(scanText('src/assets/obs/obs.json', `${header}\n`), 'private key block'));
}
t('the published ssh-ed25519 key at keys[].ssh_signing.public_key passes', () => {
  const f = scanText('team/keys.json', keysFile([{ agent: 'events.b@PrompTugal.dinis', session: 'https://claude.ai/code/session_01AbcdefghijklmnopqrstuV', ssh_signing: { public_key: ed() } }]));
  return f.length === 0 || (console.error('  found:', f.map((x) => x.kind).join(', ')), false);
});
t('an ssh-ed25519 key in another field of team/keys.json is flagged', () => {
  const k = ed();
  return has(scanText('team/keys.json', keysFile([{ agent: 'a@b.c', note: k }])), 'ssh public key outside its published field');
});
t('an ssh-ed25519 key in an ordinary file is flagged', () => has(scanText('README.md', `key: ${ed()}\n`), 'ssh public key outside its published field'));
t('an ssh-ed25519 key in an allowed-signers style line is flagged outside team/keys.json', () => has(scanText('board/x', `a@b.c namespaces="git" ${ed()}\n`), 'ssh public key outside its published field'));
for (const [name, make] of Object.entries(others)) {
  t(`a ${name} key in an ordinary file is flagged`, () => has(scanText('docs/k.md', `${make()}\n`), 'ssh public key outside its published field'));
  t(`a ${name} key even at ssh_signing.public_key is flagged (only ssh-ed25519 is published)`, () => has(scanText('team/keys.json', keysFile([{ agent: 'a@b.c', ssh_signing: { public_key: make() } }])), 'ssh public key outside its published field'));
}
t('a key-shaped value at the published field but a wrong length is flagged', () => {
  const k = ed().slice(0, 60);
  return has(scanText('team/keys.json', keysFile([{ agent: 'a@b.c', ssh_signing: { public_key: k } }])), 'ssh public key outside its published field');
});
t('the published SHA256 fingerprint at keys[].ssh_signing.fingerprint passes', () => {
  const fp = 'SHA' + '256:' + b64(32).replace(/=+$/, '');
  return scanText('team/keys.json', keysFile([{ agent: 'a@b.c', ssh_signing: { public_key: ed(), fingerprint: fp } }])).length === 0;
});
t('the same fingerprint-shaped value in another field is flagged', () => {
  const fp = 'SHA' + '256:' + ('aZ9' + b64(32)).replace(/[+/=]/g, 'x').slice(0, 43);
  return has(scanText('team/keys.json', keysFile([{ agent: 'a@b.c', note: fp }])), 'long high-entropy string');
});
t('a high-entropy token beside the published key in team/keys.json still fails', () => {
  const tok = ('Zx9' + b64(40)).replace(/[+/=]/g, 'q');
  return has(scanText('team/keys.json', keysFile([{ agent: 'a@b.c', ssh_signing: { public_key: ed() }, extra: tok }])), 'long high-entropy string');
});

let failed = 0;
for (const c of cases) { let ok = false; try { ok = c.fn(); } catch (e) { console.error(`  error: ${e.message}`); } if (!ok) { failed++; console.error(`FAIL: ${c.name}`); } }
if (failed) { console.error(`leak-scan tests FAILED (${failed} of ${cases.length})`); process.exit(1); }
console.log(`leak-scan tests OK (${cases.length} cases)`);
