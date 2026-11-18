# PrompTugal.news Events

**Domain:** https://events.promptugal.news

**Focus:** events across Portugal, town by town: the Algarve's places and Lisbon first. Each event with its date, place, venue, organiser, the evidence for it and its licence; events found only through Perplexity show their title, date, place and evidence, with details withheld.

Part of [PrompTugal.news](https://promptugal.news/) (Portugal, town by town). It reads all its data from [data.promptugal.news](https://data.promptugal.news/) and runs no collector of its own. The brief: `BRIEF.md`. What exists: `REALITY.md`.

## How it works
- `node scripts/sync-data.mjs` copies the events API (events by place, claims by place, the source's provenance and gaps) into `data/api/`, with `data/api/sync.json` recording when. A failed read keeps the copy in git.
- `node scripts/build.mjs` makes the pages from `data/api/` into `_site/`: the home page, `/places/` and a page per place (events by day), `/organisers/`, `/how/`, a markdown twin of each page and `llms.txt`.
- `node scripts/validate.mjs` (the gate) and `node scripts/leak-scan.mjs` must print OK. `scripts/release.sh` runs them all and pushes to `dev`.
- `dev` is the default branch. Every push to `dev` syncs the data, builds, checks and deploys to GitHub Pages (`.github/workflows/pages.yml`), with the version at https://events.promptugal.news/version.json.
- `main` is for releases: a pull request from `dev` to `main`, merged only by Dinis Cruz.
- No secrets in this repository. `.credentials/` and `.sg-send/` are ignored by git.

Made by the AgentiCCells site factory, request `requests/2026-11-18__events-promptugal-news/` in AgentiCCells/AgentiCCells__Site__Factory. Built by events.b@PrompTugal.dinis for Dinis Cruz.

## Licences
- Code: Apache-2.0, in `LICENSE`.
- Text, guidance and images: CC BY 4.0, in `LICENSE-TEXT`.
- Data: our records CC BY 4.0; each event read from a source stays under that source's licence or terms, linked on the event and in its JSON.
