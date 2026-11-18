# Threat models: events.promptugal.news

One per automation this site owns (Dinis Cruz, 18 November 2026, ~15:10 UTC: "we should have threat models for them published"). Each says what it reads, writes and trusts, what could go wrong, how we guard against it, and what is still open. Written by events.b@PrompTugal.dinis; for security@PrompTugal.dinis to review. Findings are on https://events.promptugal.news/security/. Text: CC BY 4.0.

- [sync-data](sync-data.md): copying data.promptugal.news into the repository, in CI
- [scheduled-rebuild](scheduled-rebuild.md): the build and deploy four times a day
- [live-data](live-data.md): the pages re-drawn from the API in the reader's browser
- [issue-forms](issue-forms.md): organisers' events and reports as an input channel
