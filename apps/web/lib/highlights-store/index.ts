// Public surface of the offline-first highlights store.
//
// The reader needs to feel instant: a click on a color swatch must paint the
// highlight immediately, even when the network is down. We hold the canonical
// state in memory + localStorage, apply mutations locally first, and replay
// them against the API when the browser is online. Replays are idempotent
// (PUT keyed by client-generated id), so a dropped response never produces a
// duplicate row.
//
// Module map:
// - types.ts      — shared shapes (HighlightColor, records, mutations, bucket)
// - storage.ts    — localStorage I/O
// - bucket.ts     — per-book bucket registry, subscribe, persist primitive
// - selectors.ts  — read paths (snapshot + pending merge, stable memoization)
// - mutations.ts  — enqueueUpsert / enqueueDelete (the only write paths)
// - sync.ts       — server snapshot apply, flush loop, on-wire conversion
// - id.ts         — client-generated highlight ids

export type {
  DropEvent,
  DropListener,
  HighlightColor,
  HighlightRecord,
  PendingMutation,
  ServerAnnotation,
} from "./types";

export {
  flushAllPendingPersists,
  getHighlightsBucket,
  setBucketAuth,
  subscribeToDrops,
  subscribeToHighlights,
} from "./bucket";

export {
  selectHighlights,
  selectStableHighlights,
} from "./selectors";

export { enqueueUpsert, enqueueDelete } from "./mutations";

export { applyServerSnapshot, flushBucket, toHighlightRecord } from "./sync";

export { generateHighlightId } from "./id";
