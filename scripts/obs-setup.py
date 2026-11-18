#!/usr/bin/env python3
"""Open events.promptugal.news's observability lane 'events' on account B (events.b@PrompTugal.dinis, 18 November 2026,
at Dinis Cruz's word: "yes, make your key with sgit pki and set up your tracking lane", and his guidance of ~14:55 UTC,
board/guidance/2026-11-18-keys-issues-rebuilds-observability.md). Adapted from PrompTugal__News__Website
newsroom/tools/obs/obs_setup.py (observability@PrompTugal.dinis, Apache-2.0), with one private vault and no public one:

    SG_SEND_ACCESS_TOKEN=... python3 -I scripts/obs-setup.py --conductor-bundle <conductor.b-promptugal bundle .json>

1. a PRIVATE data vault (promptugal-obs-events) holding a README, the drain key (an RSA-4096 pair made here; only its
   public half leaves the vault) and identity/lanes.json; four append lanes 'events 1..4' configured on it, and the
   enum key that lists them;
2. the public half in this repository: src/assets/obs/obs.json (endpoint, vault id, the lanes' append tokens, the drain's
   public key). Public on purpose: a token can only append to its lane, and the key can only encrypt;
3. the credentials (vault key, enum key, tokens) in ~/.sg-send/obs-events/creds.json (0600), outside the repository,
   and sealed to conductor.b@'s key (sgit pki encrypt) in ~/.sg-send/obs-events/creds.sealed, for conductor.b@ to drain.
Run once. Prints no credential.
"""
import argparse, datetime, hashlib, json, os, secrets, subprocess, sys, urllib.request

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'https://dev.send.sgraph.ai'
AGENT = 'events.b@PrompTugal.dinis'
DIR = os.path.expanduser('~/.sg-send/obs-events')
CREDS = os.path.join(DIR, 'creds.json')
VAULTS = os.path.expanduser('~/vaults')
NAME = 'promptugal-obs-events'
h = lambda s: hashlib.sha256(s.encode()).hexdigest()


def post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', **headers})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'{}')


def sgit(cwd, *a):
    r = subprocess.run(['sgit', *a], cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'obs-setup: sgit {a[0]} failed (exit {r.returncode})')
    return r.stdout


def wjson(p, obj, mode=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
    if mode:
        os.chmod(p, mode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--conductor-bundle', required=True, help="conductor.b-promptugal's public bundle (from PrompTugal__News__Website board/keys.json)")
    o = ap.parse_args()
    if os.path.exists(CREDS):
        sys.exit(f'obs-setup: {CREDS} exists; the lane is made already')
    os.makedirs(DIR, mode=0o700, exist_ok=True)
    token = os.environ['SG_SEND_ACCESS_TOKEN']
    from sgit_ai.crypto.PKI__Crypto import PKI__Crypto
    from sgit_ai.crypto.Vault__Crypto import Vault__Crypto
    pki, today = PKI__Crypto(), datetime.datetime.now(datetime.timezone.utc).strftime('%-d %B %Y')

    # 1. the private data vault, with the drain key inside it
    os.makedirs(VAULTS, exist_ok=True)
    d = os.path.join(VAULTS, NAME)
    if os.path.exists(d):
        sys.exit(f'obs-setup: {d} exists; this runs once')
    sgit(VAULTS, 'create', NAME, '--base-url', HOST, '--token', token, '--no-push')
    open(os.path.join(d, 'README.md'), 'w').write(
        f"# events.promptugal.news observability: the data vault (private)\n\nMade by {AGENT} on {today}, at Dinis Cruz's word, "
        "with scripts/obs-setup.py in PrompTugal/PrompTugal__News__Events. Page views and reads from events.promptugal.news "
        "(assets/obs/obs.js, lane 'events') arrive sealed to the drain key (identity/) on this vault's append lanes; "
        "conductor.b@PrompTugal.dinis drains them. Private: its read key would give out the enum key and the drain key.\n")
    priv, pub = pki.generate_encryption_key_pair()
    pub_pem, priv_pem = pki.export_public_key_pem(pub), pki.export_private_key_pem(priv)
    fp = pki.compute_fingerprint(pub)
    os.makedirs(os.path.join(d, 'identity', 'private'), exist_ok=True)
    with open(os.path.join(d, 'identity', 'private', 'private_key.pem'), 'w') as f:
        f.write(priv_pem)
    wjson(os.path.join(d, 'identity', 'public-bundle.json'), {'encrypt': pub_pem, 'fingerprint': fp, 'label': 'events.promptugal.news observability drain'})
    names = ['events 1', 'events 2', 'events 3', 'events 4']
    toks = [secrets.token_hex(32) for _ in names]
    wjson(os.path.join(d, 'identity', 'lanes.json'), {'about': 'The append lanes, in order, by the SHA-256 of each token (the anchor the server holds).',
                                                      'lanes': [{'name': n, 'anchor': h(t)} for n, t in zip(names, toks)]})
    sgit(d, 'commit', 'the data vault: README, the drain key, the lanes')
    sgit(d, 'push')
    vk = open(os.path.join(d, '.sg_vault', 'local', 'vault_key')).read().strip()
    vid = vk.split(':')[-1]
    enum_key = secrets.token_hex(32)
    write_key = Vault__Crypto().derive_keys_from_vault_key(vk)['write_key']
    r = post(f'{HOST}/api/vault/append/configure/{vid}', {'append_anchors': [h(t) for t in toks], 'enum_key_hash': h(enum_key)},
             {'x-sgraph-vault-write-key': write_key, 'x-sgraph-access-token': token})
    if r.get('status') != 'configured':
        sys.exit(f'obs-setup: configure answered {r.get("status")}')

    # 2. the public half, in this repository
    cfgp = os.path.join(ROOT, 'src', 'assets', 'obs', 'obs.json')
    cfg = json.load(open(cfgp))
    cfg.update({'endpoint': HOST, 'vault_id': vid, 'lanes': {'events': toks}, 'recipient': {'fingerprint': fp, 'encrypt': pub_pem},
                'opened': f'{today}, by {AGENT}: a private vault of its own on account B; drained by conductor.b@PrompTugal.dinis'})
    wjson(cfgp, cfg)

    # 3. the credentials: outside the repository, and sealed to conductor.b@
    creds = {'type': 'promptugal.obs/creds', 'lane': 'events', 'host': HOST, 'vault_id': vid, 'vault_key': vk, 'enum_key': enum_key,
             'tokens': toks, 'lane_names': names, 'drain_key_in_vault': 'identity/private/private_key.pem', 'made': today, 'by': AGENT}
    wjson(CREDS, creds, 0o600)
    r1 = subprocess.run(['sgit', 'pki', 'import', o.conductor_bundle], capture_output=True, text=True)
    cfp = json.load(open(o.conductor_bundle))['fingerprint']
    out = os.path.join(DIR, 'creds.sealed')
    r2 = subprocess.run(['sgit', 'pki', 'encrypt', '--recipient', cfp, '--output', out, CREDS], capture_output=True, text=True)
    sealed = 'sealed to conductor.b-promptugal in ' + out if r2.returncode == 0 and os.path.exists(out) else f'sealing FAILED (import exit {r1.returncode}, encrypt exit {r2.returncode})'
    print(f'obs-setup: data vault {vid} (private, {len(toks)} lanes configured); drain key {fp}; src/assets/obs/obs.json written; credentials in {CREDS}, {sealed}')


if __name__ == '__main__':
    main()
