import { isOnline, subscribeToNetworkState } from "../../../net/net-state";
import { cancelRetry, scheduleRetry } from "../../shared/bucket-core";
import { acknowledgeFinishDate } from "./acknowledge";
import { finishDateRuntime, isCurrentFinishDateRuntime } from "./runtime";
import { sendFinishDate } from "./send";
import type { GetToken } from "./types";
import { revalidateHome } from "../../home/revalidate";
import { revalidateLibrary } from "../revalidate";

export function flushFinishDates(getToken: GetToken): Promise<void> {
  const runtime = finishDateRuntime(getToken);
  if (!runtime.stopListening) runtime.stopListening = subscribeToNetworkState((online) => {
    if (online && isCurrentFinishDateRuntime(runtime)) void flushFinishDates(runtime.getToken);
  });
  if (runtime.flushPromise) return runtime.flushPromise;
  if (!isOnline()) return Promise.resolve();
  runtime.flushPromise = drainWithLock(runtime).catch(() => {
    if (isCurrentFinishDateRuntime(runtime)) retry(runtime);
  }).finally(() => {
    runtime.flushPromise = null;
    // Catch a local write arriving just as the drain saw an empty queue.
    if (!runtime.retryHandle && isOnline() && isCurrentFinishDateRuntime(runtime)) {
      void runtime.db.finishDateMutations.count().then((count) => {
        if (count && !runtime.retryHandle && isCurrentFinishDateRuntime(runtime)) {
          void flushFinishDates(runtime.getToken);
        }
      }).catch(() => {});
    }
  });
  return runtime.flushPromise;
}

async function drainWithLock(runtime: ReturnType<typeof finishDateRuntime>): Promise<void> {
  // Tabs share this queue. Read its head only after acquiring the lock, so
  // an older tab cannot send an already acknowledged date after its removal.
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(`ava-reader:finish-date:${runtime.db.name}`, () => drain(runtime));
  } else {
    await drain(runtime);
  }
}

async function drain(runtime: ReturnType<typeof finishDateRuntime>): Promise<void> {
  if (!isOnline() || !isCurrentFinishDateRuntime(runtime)) return;
  cancelRetry(runtime);
  let changed = false;
  while (isOnline() && isCurrentFinishDateRuntime(runtime)) {
    const head = await runtime.db.finishDateMutations.orderBy("queuedAt").first();
    if (!head) {
      if (changed) void Promise.allSettled([revalidateHome(runtime.getToken), revalidateLibrary(runtime.getToken)]);
      return;
    }
    const token = await runtime.getToken();
    if (!isCurrentFinishDateRuntime(runtime)) return;
    if (!token) { retry(runtime); return; }
    const result = await sendFinishDate(head, token);
    if (!isCurrentFinishDateRuntime(runtime)) return;
    if (result.kind === "retry") { retry(runtime); return; }
    await acknowledgeFinishDate(runtime.db, head,
      result.kind === "saved" ? result.finishedAt : undefined,
      result.kind === "drop" ? result.reason : undefined);
    if (!isCurrentFinishDateRuntime(runtime)) return;
    runtime.retryDelayMs = 0;
    changed = true;
  }
}

function retry(runtime: ReturnType<typeof finishDateRuntime>): void {
  scheduleRetry(runtime, () => {
    if (isCurrentFinishDateRuntime(runtime)) void flushFinishDates(runtime.getToken);
  });
}
