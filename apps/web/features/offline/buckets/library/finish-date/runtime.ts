import { liveQuery } from "dexie";
import { getDb, type AvaReaderDB } from "../../../db";
import { cancelRetry } from "../../shared/bucket-core";
import { readFinishDateFailures } from "./failure-store";
import type { FinishDateSyncFailure, GetToken } from "./types";

type Runtime = {
  db: AvaReaderDB;
  getToken: GetToken;
  flushPromise: Promise<void> | null;
  retryHandle: ReturnType<typeof setTimeout> | null;
  retryDelayMs: number;
  stopped: boolean;
  stopListening?: () => void;
};

const runtimes = new Set<Runtime>();
const failureSubscriptions = new Set<() => void>();
let generation = 0;

export function finishDateGeneration() { return generation; }
export function markFinishDateChange() { generation += 1; }

export function finishDateRuntime(getToken: GetToken): Runtime {
  const db = getDb();
  const existing = [...runtimes].find((runtime) => runtime.db === db);
  if (existing) {
    existing.getToken = getToken;
    return existing;
  }
  const runtime: Runtime = {
    db, getToken, flushPromise: null, retryHandle: null,
    retryDelayMs: 0, stopped: false,
  };
  runtimes.add(runtime);
  return runtime;
}

export function isCurrentFinishDateRuntime(runtime: Runtime): boolean {
  return !runtime.stopped && runtime.db === getDb();
}

export function subscribeToFinishDateSyncFailures(
  listener: (event: FinishDateSyncFailure) => void,
): () => void {
  const db = getDb();
  let active = true;
  let delivered = new Map<string, string>();
  // Observe the shared per-user store so a rejection drained by another tab
  // reaches this card too, including after navigation or a browser restart.
  const subscription = liveQuery(() => readFinishDateFailures(db)).subscribe({
    next: (events) => {
      if (!active || db !== getDb()) return;
      for (const event of events) {
        if (delivered.get(event.libraryItemId) !== event.revision) {
          listener({ libraryItemId: event.libraryItemId, reason: event.reason });
        }
      }
      delivered = new Map(events.map((event) => [event.libraryItemId, event.revision]));
    },
    // Closing an account's database during sign-out must not surface an old
    // account's error. A new card subscription resumes reads for its own DB.
    error: () => {},
  });
  const unsubscribe = () => {
    active = false;
    subscription.unsubscribe();
    failureSubscriptions.delete(unsubscribe);
  };
  failureSubscriptions.add(unsubscribe);
  return unsubscribe;
}

export function clearFinishDateRuntime(): void {
  for (const runtime of runtimes) {
    runtime.stopped = true;
    cancelRetry(runtime);
    runtime.stopListening?.();
  }
  runtimes.clear();
  for (const unsubscribe of failureSubscriptions) unsubscribe();
  markFinishDateChange();
}
