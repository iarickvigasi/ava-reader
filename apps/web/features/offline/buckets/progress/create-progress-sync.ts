import { liveQuery } from "dexie";
import { getDb } from "../../db";
import { isOnline } from "../../net/net-state";
import { cancelRetry, scheduleRetry } from "../shared/bucket-core";
import { listDirtyProgress } from "./storage";
import { flushDirtyProgress } from "./sync";
import type { GetProgressToken } from "./types";

export function createProgressSync(getToken: GetProgressToken) {
  const db = getDb();
  const retry = {
    retryDelayMs: 0,
    retryHandle: null as ReturnType<typeof setTimeout> | null,
  };
  let stopped = false;
  let running = false;
  function queue() {
    if (!stopped && !retry.retryHandle) scheduleRetry(retry, () => void run());
  }
  async function run() {
    cancelRetry(retry);
    if (stopped || running || db !== getDb()) return;
    if (!isOnline() || document.visibilityState !== "visible") return;
    running = true;
    try {
      const result = await flushDirtyProgress(getToken);
      if (result.synced) retry.retryDelayMs = 0;
    } catch {
      /* Persistence failures retry through the same durable queue. */
    } finally {
      running = false;
      if (!stopped && db === getDb()) {
        try {
          if ((await listDirtyProgress(db)).length) queue();
        } catch {
          /* A closed account database is retried by its next owner mount. */
        }
      }
    }
  }
  const subscription = liveQuery(() => listDirtyProgress(db)).subscribe({
    next(rows) {
      if (rows.length) queue();
      else {
        cancelRetry(retry);
        retry.retryDelayMs = 0;
      }
    },
    error() {
      cancelRetry(retry);
    },
  });
  return {
    run,
    stop() {
      stopped = true;
      cancelRetry(retry);
      subscription.unsubscribe();
    },
  };
}
