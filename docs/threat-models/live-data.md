# Threat model: live data in the browser (`src/assets/live.js`, `src/assets/render.mjs`)

Status: first version, 18 November 2026; updated 19 November 2026 for Dinis's rule "load the data in the browser" (Website board/guidance/2026-11-19-load-the-data-in-the-browser.md). events.b@PrompTugal.dinis. Not yet reviewed by security@.

## What it does
On each place page and the home page, the reader's browser fetches that place's events from data.promptugal.news and re-draws the list with the same renderer the build uses, with "today" taken in Lisbon time now. If any read fails, the built page stays.

## Reads
- `https://data.promptugal.news/api/v1/events/by-place/<place>.json` and `/claims/by-place/<place>.json`; `<place>` comes from the page's own markup and must match `[a-z0-9-]`.

## Writes
- The list element of the page, its status line and its counts, as DOM nodes built with createElement and textContent (never innerHTML), from the same element tree the build serialises to escaped HTML. No cookies, no storage, nothing sent anywhere by this code; every request is made with no cookie and no referrer.

## Trusts
- TLS to data.promptugal.news; nothing in the content.

## What could go wrong
1. Cross-site scripting: an API value (name, venue, link, place, date) carrying markup or a script, written into the page.
2. A hostile link (`javascript:`, `data:`) shown as a link.
3. A huge or malformed answer freezing or breaking the page.
4. The data site being down: readers see nothing.

## Mitigations
- Redirects are refused (`redirect: 'error'`, and a response not from the fixed address under data.promptugal.news/api/v1/events/ is dropped): a moved or hijacked path cannot hand the page a file from elsewhere; the built copy stays (security@'s ruling, 19 November 2026; tested with a 302 at 07:35 UTC).
- Each loaded file's own licence is shown beside its read time, read from the file's `license` (name and holder, short plain text only, set with textContent), in the built copy and the live one.
- (1) Every value is escaped before it reaches the HTML; place ids and dates are checked against strict patterns and anything else is dropped or replaced (finding EV-2026-001, high, fixed; EV-2026-002, fixed). Tested with crafted input.
- (2) Only `http` and `https` links without spaces, quotes or angle brackets are made into links (EV-2026-004, fixed).
- (3) Malformed items are skipped; a failure leaves the built page (EV-2026-007, fixed).
- (4) The built page is the fallback. A file replaces it only if it has the expected shape, at most 5,000 items, and a read time no older than the built copy; the status line says "Live file" or "Built copy" with the read time, and "Stale" when the data is more than 7 hours old (the agendas are read every 6 hours). It refreshes every 10 minutes.

- (1, 2) A Content Security Policy on every page (a meta tag, since GitHub Pages sets no headers): scripts and styles from this site only, no inline script, no plugins, and connections only to data.promptugal.news and the page-view endpoint (the two place lookups were removed on 19 November 2026). Added 18 November 2026, tested on nine pages with no violations.

- The PrompTugal sites bar (v1.1.0, vendored unchanged and pinned by sha256; reviewed by security@) is rendered at build from the sites registry, and its script fetches only other PrompTugal sites' `/version.json` and shows their `/preview.svg` as an image. The policy lists the exact hosts: this site, the data site, each site in the registry that passes the bar's own check, and the page-view endpoint.

## Closed
- The page-view script no longer asks any third party (ipapi.co, ipwho.is) where a reader is. It sends the country only, taken in the browser from the time zone through a fixed table, with no network call; region, city and map position are dropped (Dinis, 19 November 2026 ~03:15 UTC, Website `board/guidance/2026-11-19-no-ip-lookup-predictions-and-small-decisions.md`). Both hosts are out of the CSP.

## Open
- Framing (clickjacking) cannot be refused from a meta tag; low risk for a static site with no login or actions.
