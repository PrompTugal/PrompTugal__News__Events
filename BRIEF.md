# BRIEF: events.promptugal.news

The brief this site is built from, kept in full. Where it turns out wrong, corrections go in `BRIEF-CORRECTIONS.md`; what exists is in `REALITY.md`.

## Dinis Cruz's words (18 November 2026)

Recorded by conductor.b@PrompTugal.dinis in PrompTugal__News__Website `board/guidance/` (the files named below hold the full quotes).

- About 13:50 UTC (`2026-11-18-s53-and-the-events-site.md`): "a new site (and data collection) focused on Events that are happening on each region/city ... amazing value for our local sites, just like the weather ... help with some of the AgenticCells powered websites (which need live event data)". "Yes go and start building it, as I go and create the repo."
- About 14:10 UTC (`2026-11-18-sources-we-do-not-access.md`): "it's super critical to have a list of every single organization that we know we could get data from, but we don't because they don't give us permission, and we basically will respect whatever they say."
- About 14:15 UTC (`2026-11-18-events-in-two-phases.md`): "Why don't we do this in two phases, since we can't publish it, but we can look into it ... use Perplexity for this ... everyone that you have there that points to a source that we don't have is a gap in our sources ... we can't put the details for now, which is also an interesting situation for us to even nudge the organizers to say, hey, can you give us more details". "show the data that we collect, the visualization of the data that we collect, the provenance of the data, where the data is".
- About 14:25 UTC (`2026-11-18-licences-and-submissions.md`): "When he sends his own details, we publish them, credited, and remember that eventually we want to have PKI here". "Every data that we publish, everything that we put is in the Creative Commons ... any data that we collect for somebody else is basically on their license. So we should also always show the license." "When we show the title ... like a search engine does, we should credit Perplexity".
- About 14:30 UTC: "repo is created".

## The brief to events.b@PrompTugal.dinis (from conductor.b@, 18 November 2026)

events.promptugal.news, Portugal's events town by town, built from data.promptugal.news's API (this repository runs no collectors and makes no OpenRouter calls; data comes from data.b@). The first version:

- a home page and a page per place (Algarve places and Lisbon first) listing events by day, each with its date, place, venue, organiser (an organisation), the evidence links, and its licence link (ours CC BY 4.0; a source's own licence; or "the source's terms" linked);
- details only from sources we may read; an event known only through Perplexity's discovery shows its title, date, place and the evidence, credited "found through Perplexity", with "details withheld: the source's terms do not let us copy them; organisers, send them to us";
- an organisers' page: how an organiser sends its own event (published, credited and dated as theirs; signed with PKI later);
- a /how/ page: the data, its provenance, where it lives, and links to data.promptugal.news's register and gaps; the graph (event, venue, organiser, past editions, places, companies) as ontologist@ and data.b@ define it;
- the masthead and links back to promptugal.news and the other sites, as the five sites do.

Never machine-read eventbrite.*, lu.ma, luma.com or meetup.com. dev deploys; never push to main.
