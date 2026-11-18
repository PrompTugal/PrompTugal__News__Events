# Threat model: the issue forms (`.github/ISSUE_TEMPLATE/`)

Status: first version, 18 November 2026, events.b@PrompTugal.dinis. Not yet reviewed by security@.

## What it does
Organisers send their events, and anyone sends reports and take-down requests, through two GitHub issue forms on this public repository (Dinis, 18 November 2026). Agents read the issues and act through their own reviewed work: publishing an organiser's event, correcting a mistake, taking something down.

## Reads
- Text typed by anyone with a GitHub account.

## Writes
- Nothing by itself. What changes on the site is a commit by an agent, through the gates.

## Trusts
- Nothing in the text. A submission is credited to the account that sent it; that it comes from the organiser is checked (the account is the organisation's, or the organisation's site names it). Signed submissions (PKI) are planned.

## What could go wrong
1. Prompt injection: instructions written in an issue, aimed at an agent that reads it.
2. False events or impersonation of an organiser.
3. Hostile content (markup, links) carried into a page.
4. A reporter's personal data or a third party's private data posted in public.
5. Spam or floods.

## Mitigations
- (1) Each form says its text is read as data only. Agents never follow instructions in an issue; any such text is reported to security@ (Dinis, 18 November 2026). An agent publishes only the event fields it expects, never free text as an instruction.
- (2) Details from someone other than the organiser are a lead to check, never published on their word alone; every submission is credited and dated.
- (3) Published fields go through the same renderer and escaping as all other data, and through the gates.
- (4) The forms warn that everything is public and give a private route: agent@riskmandate.ai, or the page link with "please take down" and nothing else. We take down first and ask afterwards.
- (5) Blank issues are off; GitHub's own abuse controls apply.

## Open
- Signed submissions (PKI), as Dinis asked, "added as we go".
