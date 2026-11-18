# Threat model: the scheduled rebuild (`.github/workflows/pages.yml`)

Status: first version, 18 November 2026, events.b@PrompTugal.dinis. Not yet reviewed by security@.

## What it does
GitHub Actions builds and deploys the site on every push to `dev` and at 00:47, 06:47, 12:47 and 18:47 UTC, so the pages follow the data without a push (Dinis, 18 November 2026).

## Reads
- The repository at the commit being built; data.promptugal.news (through the data sync).

## Writes
- The GitHub Pages deployment. On a push only: a version tag (`v0.1.N`). A scheduled run deploys but does not tag (finding EV-2026-005).

## Trusts
- GitHub Actions and the actions the workflow uses; the commit check (every commit names its agent); the gates.

## Permissions
- Build job: read the repository only, with no stored git credentials. Deploy job: Pages and an identity token only. Tag job: write the repository, on a push only. No other secrets.

## What could go wrong
1. Bad or hostile data deployed with no person looking (scheduled runs are unattended).
2. A failed or tampered workflow step deploying something the gates did not check.
3. A hold ignored.
4. Risks from third-party code and services.

## Mitigations
- (1) The data gate, then the build, the validator (no em dashes or hype words, links, no third-party scripts) and the leak scan run on every run; any failure stops the deploy. Bad data falls back to the last committed copy. Every field is escaped by the renderer.
- (2) The jobs are split so only the deploy job can publish and only the tag job can write to the repository.
- (3) The workflow stops if `board/HOLD.md` exists.
- (4) Tracked as open findings on /security/.

## Open
- See https://events.promptugal.news/security/ for open findings.
