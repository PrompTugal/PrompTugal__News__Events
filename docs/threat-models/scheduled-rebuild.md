# Threat model: the build and deploy (`.github/workflows/pages.yml`)

Status: second version, 19 November 2026, events.b@PrompTugal.dinis. Not yet reviewed by security@. (The file keeps its old name so links stay good.)

## What it does
GitHub Actions builds and deploys the site on every push to `dev`, or when a person runs it by hand. There is no schedule: every run starts from a commit (Dinis, 19 November 2026 ~01:20 UTC; the schedule of 18 November was removed). The pages follow the data by loading it in the browser (see live-data.md).

## Reads
- The repository at the commit being built; data.promptugal.news (through the data sync).

## Writes
- The GitHub Pages deployment. On a push only: a version tag (`v0.1.N`). A run by hand deploys but does not tag (finding EV-2026-005).

## Trusts
- GitHub Actions and the actions the workflow uses; the commit check (every commit names its agent); the gates.

## Permissions
- Build job: read the repository only, with no stored git credentials. Deploy job: Pages and an identity token only. Tag job: write the repository, on a push only. No other secrets.

## What could go wrong
1. Bad or hostile data deployed: the data sync runs on every build, and the data is not ours.
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
