# Historical implementation evidence — 31 October 2026

Snapshot retained verbatim; current status: [shared task](../items/2026-10-31-word-narration.md).

## Retained failures and recovery

Initial shared dependencies were older than current main: missing packages and stale Prisma types.
Installed this worktree's frozen-lockfile dependencies independently; no original dependencies were
modified. Corepack cache access initially failed under the sandbox. Prisma required a placeholder
DATABASE_URL for generation, then generation without an engine download via
PRISMA_GENERATE_NO_ENGINE=1; no database connection/migration occurred.

Initial broad tests hit socket EPERM, worker resource failure and archive timeout under concurrency.
Reruns with API local sockets/in-band and web maxWorkers=2 all pass. One task test had an unbound
mock-method lint error, repaired by asserting its standalone mock. Browser setup initially lacked
Clerk's server key; reused existing local configuration without displaying/copying secrets. Next
regenerated apps/web/AGENTS.md at startup; restored its original content.

## Handoff

Initial handoff had no commit, push, merge or deployment; later authorized commits are recorded below. Scope remains selected words/phrases, not full-book listening.
Reader billing is absent; AVA pays provider usage. Documentation owners, overview, product, ADR,
architecture, styles and README reconciled. Current main has no Atlas/qa commands from the alternate
uncommitted handbook, so those commands are inapplicable here. Next action: human/device listening
and signed-in end-to-end qualification before release.

- Documentation: main uses docs/specs rather than the uncommitted handbook in the original checkout;
  that checkout is preserved. No merge, push or deployment authorized/performed.
- Provider reference: https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/
  confirms model, endpoint, voice names, MP3 and lack of numeric speed control on v4.
- Research tooling: chub unavailable; Tavily returned no usable result; official web docs used.

## Local testing environment

At the founder's request, started this worktree on localhost:3000 (web) and localhost:4000 (API).
An isolated `ava-narration` PostgreSQL container uses port 15432 and a new persistent volume;
no existing AVA database container/volume was found. Applied all 31 migrations to that new database.
Library starts empty; sign in and upload an EPUB for testing. API/database health and web/sign-in
respond 200; unauthenticated narration responds 401. Existing local Clerk/OpenRouter configuration
is supplied only through process environment. Language hints were subsequently implemented in the contextual-language follow-up below.

## Preferences cleanup requested during testing

Founder requested hiding the Listening placeholders. Removed the section (voice, ambient, speed)
and its unused helpers; updated preferences spec, parent overview and product roadmap. Web typecheck,
lint, formatting and actual Chromium preferences checks at 1280px/390px pass. The first browser check
used a nonexistent label and timed out; corrected to the existing reading-goal accessible label.
No new tests were added for this reversible presentation removal. Selection narration is unchanged.
