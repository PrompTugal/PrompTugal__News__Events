# Threat model: live data in the browser (`src/assets/live.js`, `src/assets/render.mjs`)

Status: first version, 18 November 2026, events.b@PrompTugal.dinis. Not yet reviewed by security@.

## What it does
On each place page and the home page, the reader's browser fetches that place's events from data.promptugal.news and re-draws the list with the same renderer the build uses, with "today" taken in Lisbon time now. If any read fails, the built page stays.

## Reads
- `https://data.promptugal.news/api/v1/events/by-place/<place>.json` and `/claims/by-place/<place>.json`; `<place>` comes from the page's own markup and must match `[a-z0-9-]`.

## Writes
- The list element of the page (its inner HTML). No cookies, no storage, nothing sent anywhere by this code.

## Trusts
- TLS to data.promptugal.news; nothing in the content.

## What could go wrong
1. Cross-site scripting: an API value (name, venue, link, place, date) carrying markup or a script, written into the page.
2. A hostile link (`javascript:`, `data:`) shown as a link.
3. A huge or malformed answer freezing or breaking the page.
4. The data site being down: readers see nothing.

## Mitigations
- (1) Every value is escaped before it reaches the HTML; place ids and dates are checked against strict patterns and anything else is dropped or replaced (finding EV-2026-001, high, fixed; EV-2026-002, fixed). Tested with crafted input.
- (2) Only `http` and `https` links without spaces, quotes or angle brackets are made into links (EV-2026-004, fixed).
- (3) Malformed items are skipped; a failure leaves the built page (EV-2026-007, fixed).
- (4) The built page is the fallback.

- (1, 2) A Content Security Policy on every page (a meta tag, since GitHub Pages sets no headers): scripts and styles from this site only, no inline script, no plugins, and connections only to data.promptugal.news and the page-view endpoint and place lookups. Added 18 November 2026, tested on nine pages with no violations.

- The PrompTugal sites bar (v1.1.0, vendored unchanged and pinned by sha256; reviewed by security@) is rendered at build from the sites registry, and its script fetches only other PrompTugal sites' `/version.json` and shows their `/preview.svg` as an image. The policy allows images and connections to `https://promptugal.news` and `https://*.promptugal.news`.

## Open
- The `*.promptugal.news` wildcard trusts any subdomain, including one that was abandoned or taken over; accepted because the registry keeps adding sites, and the bar fetches only JSON and images, never scripts.
- Framing (clickjacking) cannot be refused from a meta tag; low risk for a static site with no login or actions.
