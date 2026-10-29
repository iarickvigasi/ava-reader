# Conventions

## Docs

Docs aim for ≤60 lines (architecture/product ≤150, specs ≤130). Keep only useful, non-repeated
information. Wrap prose at 100 characters, break at word boundaries, continue blockquotes with `> `
and lists with hanging indents. Headings, tables and unbreakable paths/URLs may exceed the width.

Only [styles.md](styles.md) describes UI placement/appearance: layout, spacing, type, colors, icons
and sizing. Other docs cover logic, behavior, data, permissions, states and operations; link to
styles.md instead of repeating visual rules. Keep geometry needed for correctness and source-format
parsing semantics. Acceptance criteria verify behavior, not styling.

## Specs

Specs use numbered `N-<feature>.md` from `_template.md`, ≤130 lines. Multi-subsystem features use a
folder with `_overview.md` (summary, shared model, sub-spec map) and numbered sub-specs; otherwise
use one file. Children link to the overview instead of repeating its shared model.

## Code

- Files & folders kebab-case. Tests co-located as \*.test.ts(x).
- Logic in `apps/web/features/*`; UI in `apps/web/components/*`; API contracts in
  `apps/web/lib/api-types/*`.
- React function components; logic in `use-*.ts` hooks; shared state via `*-context.tsx` + a useX()
  hook that asserts non-null.
- Strict TS. Prefer `type` over interface; shapes live in types.ts. `@/*` → apps/web root.
- Use the shared presentation primitives and follow [styles.md](styles.md) for all visual rules.
- No React Query/SWR: server components fetch the initial payload (server-api.ts); clients subscribe
  to buckets. Exception (ADR 4): reader/book-info/collection pages are generic shells — a client
  loader resolves the slug from `location.pathname` and hydrates from buckets.

## Clean code (target — much existing code predates this; refactor toward it, never add to a violation)

- Files ≤100 lines, one function/component per file; split oversized UI into subcomponents/hooks.
- Components present data; `use-*.ts` hooks and pure functions in `features/*` own logic.
- Functions single-purpose: intent-revealing names, early returns, shallow nesting, few params (pass
  an options object past ~3).
- Delete dead/commented-out code and unused exports. Name constants instead of magic numbers.
- Roles/statuses/keys use owning-module constants. Reuse existing enums/constants and derive types
  where possible. Application logic uses constants; test literals may verify external/legacy
  contracts.
- Prefer composition over flags/booleans sprawl. Keep modules cohesive; one reason to change.

## Bucket pattern (offline-first idiom)

Each domain under features/offline/buckets/<name>/ has a fixed file set — mirror it exactly:

- types.ts — domain shapes; id.ts — client ULIDs; index.ts — sole public entry point
- storage.ts — Dexie I/O only; bucket.ts — in-memory registry, listeners, hydration
- selectors.ts — version-memoized snapshot + pending; mutations.ts — enqueue\*, one pending/id
- sync.ts — applyServerSnapshot + flush loop + retry

Mutations apply in-memory instantly, persist to Dexie fire-and-forget, flush idempotently on
reconnect. Large buckets group files into domain subfolders, keeping index.ts as the only external
entry point; consumers must not import a bucket subfolder directly.

## Tests

Vitest (web), Jest (API). Use fake-indexeddb; await `*PersistDrain()` — never poll timers.
