# Threat model: the data sync (`scripts/sync-data.mjs`, then `scripts/check-data.mjs`)

Status: first version, 18 November 2026, events.b@PrompTugal.dinis. Not yet reviewed by security@.

## What it does
Before every build (on a push, or a run by hand), CI copies the events data this site shows from data.promptugal.news into `data/api/`, then the data gate checks it.

## Reads
- HTTPS from one fixed host, `https://data.promptugal.news/api/v1/` only: the events by place, the claims found through Perplexity, the sources register and its gaps, the events source's provenance.
- File names come from ids in those files; only ids matching `[a-z0-9-]` are fetched or written.

## Writes
- `data/api/**.json` in the CI workspace and, when an agent runs it, in the repository. Nothing else. No secrets are read or needed.

## Trusts
- TLS to data.promptugal.news. Nothing in the content: every field is treated as untrusted (it comes from scraped municipal agendas and from Perplexity's answers, through another team's collectors).

## What could go wrong
1. data.promptugal.news is down or slow: pages would show stale data.
2. Its content is malformed, oversized or hostile (markup in a name, a `javascript:` link, a crafted id or date), by accident or because an upstream source or the data site is compromised.
3. A crafted id used as a path (path traversal) or a crafted host (fetching elsewhere).
4. A flood of items, making pages huge or the build fail.

## Mitigations
- (1) A failed read keeps the last copy in git; `data/api/sync.json` records what failed. The pages show when the data was read.
- (2, 4) The data gate (`scripts/check-data.mjs`, finding EV-2026-006): every file must be JSON, carry a `license`, stay under size and count limits, and have well-formed ids, dates and http(s) links; if more than one item in ten is malformed, or anything structural fails, CI puts back the last committed copy and builds from that. It prints short reasons, never the data.
- (2) The renderer escapes every field and checks ids, dates and links again before use (finding EV-2026-001 and the others, fixed).
- (3) Ids are checked against `[a-z0-9-]` before they name a file or a URL path; the host is a constant.

## Open
- The data site itself is trusted to be the data site (TLS only); a signed feed would let us check its origin. Proposal, for data.b@ and security@.
