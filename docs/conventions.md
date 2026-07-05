# Conventions

## Docs
Every file in docs/ is ≤60 lines where possible — aim for it (architecture.md and product.md may reach ≤100). Each line earns its place: condensed, no repetition, only what a developer or agent needs.

## Specs
≤60 lines. Numbered `N-<feature>.md` from `_template.md`. A feature that spans several distinct subsystems becomes a folder `N-<feature>/` with `_overview.md` (summary, shared model, sub-spec map) + numbered sub-specs; otherwise it stays one file. Don't repeat the shared model in children — link to the overview. Today only reader is a folder.

## Code
- Files & folders kebab-case. Tests co-located as *.test.ts(x).
- Logic in apps/web/features/*; UI in apps/web/components/*; API contracts in apps/web/lib/api-types/*.
- React function components; logic in use-*.ts hooks; shared state via *-context.tsx + a useX() hook that asserts non-null.
- Strict TS. Prefer `type` over interface; shapes live in types.ts. `@/*` → apps/web root.
- Tailwind v4 + cn() (lib/cn.ts). Theme via data-theme + CSS vars; no hardcoded colors. Visual language (tokens, radius, borders, buttons, modals) lives in [styles.md](styles.md).
- No React Query/SWR: server components fetch the initial payload (server-api.ts); clients subscribe to buckets. Exception (ADR 4): reader/book-info/collection pages are generic shells — a client loader resolves the slug from `location.pathname` and hydrates from buckets.

## Clean code (target — much existing code predates this; refactor toward it, never add to a violation)
- Files ≤100 lines. One function or one component per file; split a large component into subcomponents + hooks in its folder.
- Components stay presentational; logic lives in use-*.ts hooks and pure functions under features/*.
- Functions single-purpose: intent-revealing names, early returns, shallow nesting, few params (pass an options object past ~3).
- No dead or commented-out code, no unused exports — delete, don't disable. No magic numbers; name constants.
- Prefer composition over flags/booleans sprawl. Keep modules cohesive; one reason to change.

## Bucket pattern (offline-first idiom)
Each domain under features/offline/buckets/<name>/ has a fixed file set — mirror it exactly:
- types.ts — Record, PendingMutation, DropEvent, State shapes
- storage.ts — Dexie I/O only
- bucket.ts — in-memory registry, listeners, hydration
- selectors.ts — merge snapshot + pending (memo-stable via version)
- mutations.ts — enqueue* write paths (coalesce one pending per id)
- sync.ts — applyServerSnapshot + flush loop + retry
- id.ts — client ULIDs · index.ts — public surface
Mutations apply in-memory instantly, persist to Dexie fire-and-forget, flush idempotently on reconnect.

## Tests
Vitest (web), Jest (API). Use fake-indexeddb; await *PersistDrain() — never poll timers.
