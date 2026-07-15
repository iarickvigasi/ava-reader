# Agent guide — how AI works here

Read first, every task: this file, conventions.md, styles.md, glossary.md, architecture.md,
product.md, and the relevant docs/specs/*.md. For consequential decisions, read docs/adr/*.

## Workflow
1. Find or write the spec. New feature → create docs/specs/N-<feature>.md (next number) from
   _template.md; if it spans several subsystems, make it a folder (see conventions.md). Fix or
   extension → edit the existing spec first, then code.
2. Sanity-check against product.md (does it serve a stated job? is it on the no-list?) and
   architecture.md (does it fit the patterns?).
3. Implement to match the spec and conventions.md. Reuse existing idioms — buckets, locators, panels
   — never a parallel mechanism.
4. Update the spec (acceptance criteria, open questions) as reality changes. Spec and code stay in
   sync; a drifted spec is a bug.
5. A real, hard-to-reverse decision (auth, payments, a sticky library/provider) → write
   docs/adr/N-title.md before the spec or code.

## Rules
- Spec is source of truth for behaviour, ADR for decisions; code follows them.
- A fix never gets its own spec — edit the existing spec that owns the behaviour (Workflow §1);
  never add a new docs/specs/N file for a bug fix.
- Offline-first is non-negotiable: user data flows through a bucket, not a raw fetch.
- Next.js 16 here differs from training data — see apps/web/AGENTS.md before touching the web app.
- Respect the size limits in conventions.md (docs ≤60, specs ≤60, code files ≤100). Edit the right
  file instead of duplicating.
- Clean code: one function/component per file; split large components; logic in hooks + pure
  functions. Refactor toward the limits, never add to a violation.
- Relocating a file (splitting a folder, renaming) → `git mv` it, then edit the moved file in
  place. Never `rm`/delete the old path and `Write` a fresh file at the new one — that severs git's
  rename tracking and history. A 1-to-many split (one file's logic spread across several new ones)
  still starts with `git mv` for whichever new file keeps most of the original; the rest are
  legitimately new files.
- Verify before declaring done: pnpm typecheck, lint, test.
