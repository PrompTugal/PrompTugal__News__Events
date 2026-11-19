# Threat model: signed commits (`scripts/check-signatures.mjs`)

Status: first version, 19 November 2026, events.b@PrompTugal.dinis. Not yet reviewed by security@.

## What it does
Every commit after the one that added the check must carry a good git SSH signature by a key published in `team/keys.json` of its parent commit (of every parent, for a merge), name that key's agent in its `Agent:` trailer, and carry the session published with the key in its `Claude-Session:` trailer (Dinis, 19 November 2026 ~01:05 UTC; security@'s five controls, Website a250cc42). It runs in `scripts/release.sh` before every push and in the Pages workflow before the build; its own tests (`scripts/test-check-signatures.mjs`) run first.

## Reads
- The repository's history from the commit that added the check to the commit being built; `team/keys.json` at each commit's parents.

## Writes
- Nothing. A temporary allowed-signers file, removed after the run.

## Trusts
- `ssh-keygen` (OpenSSH) to verify signatures; git to list commits and trailers.

## What could go wrong
1. A commit signed by someone other than its named agent, or not signed at all, reaching the site.
2. A commit that publishes a new key and signs itself with it.
3. A bad commit hidden on a side branch and merged in.
4. An exemption by name used to slip a commit through.
5. The signing half of the key leaking.

## Mitigations
- (1) Every commit is verified against the published keys and both trailers; one failure fails the whole run, and the workflow deploys nothing from a failed build.
- (2) Keys come from the parent commit's `team/keys.json`, never the commit's own.
- (3) Every commit in the range is listed (merges and side branches included); a merge is checked against the keys of all its parents.
- (2b) The base is pinned: every checked tip must descend from 284a5ea (the commit that added the check), and an orphan commit in the range fails (one brought in by merging an unrelated history too), a shallow checkout is refused (in the check and as its own CI step), so a pushed history of its own cannot bring its own keys (videos.b@'s finding, 19 November 2026).
- (2c) CI and release.sh run every security check (signatures, trailers, the leak scan, with their configs) from the last release tag's copy, never from the pushed tree, and fail if it is missing (security@'s controls 7 and 8). In CI the trailer and signature checks are extracted and run in one step before any pushed-tree code runs, and the leak scan is extracted in the step that runs it, each under `env -i`, so pushed code can neither replace them nor steer node through the step environment. Checks skip only ancestors of their pinned bases. Each change to a check takes effect from the release after it.
- (4) There is no exemption of any kind: this repository's CI makes no commits (it pushes version tags only).
- (5) The signing half stays in the session, outside the repository. The leak scan fails any private key header anywhere, and flags any SSH public key except the exact ed25519 value at `keys[].ssh_signing.public_key` in `team/keys.json` (security@, 312c4601 and 1acd10498); both rules have tests (`scripts/test-leak-scan.mjs`).

## Open
- Branch protection on `dev`, and rules on who may push `v*` tags, are Dinis's to set: anyone who can push a tag or edit the workflow can still choose what CI runs; until then a push that skips `release.sh` is still caught by the workflow, which then deploys nothing.
