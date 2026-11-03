import { liveQuery } from "dexie";
import { getDb } from "../../db";
import { SESSION_LEASE_KEY } from "./constants";

export function watchSessionLease(onAvailable: () => void): () => void {
  const db = getDb();
  const subscription = liveQuery(() =>
    db.meta.get(SESSION_LEASE_KEY),
  ).subscribe({
    next: (lease) => {
      if (!lease && db === getDb()) onAvailable();
    },
    error: () => undefined, // The checkpoint timer retries silently if observation fails.
  });
  return () => subscription.unsubscribe();
}
