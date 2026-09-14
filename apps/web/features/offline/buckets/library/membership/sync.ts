import { isOnline, subscribeToNetworkState } from "../../../net/net-state";
import { cancelRetry, scheduleRetry } from "../../shared/bucket-core";
import { revalidateHome } from "../../home/revalidate";
import { refreshFromDb } from "../bucket";
import { acknowledgeMembership } from "./acknowledge";
import { isCurrentMembershipRuntime, membershipRuntime, reportMembershipDrop } from "./bucket";
import { sendMembership } from "./send";
import type { GetToken } from "./types";
import { readCompletionRevision } from "../../../completion/state";

export function flushCollectionMemberships(getToken: GetToken): Promise<void> {
  const runtime = membershipRuntime(getToken);
  if (!runtime.stopListening) runtime.stopListening = subscribeToNetworkState((online) => {
    if (online && isCurrentMembershipRuntime(runtime)) void flushCollectionMemberships(runtime.getToken);
  });
  if (runtime.flushPromise) return runtime.flushPromise;
  if (!isOnline()) return Promise.resolve();
  runtime.flushPromise = drainWithLock(runtime).finally(() => {
    runtime.flushPromise = null;
    // A save can finish just as the drain observed an empty queue. Pick it
    // up without waiting for another reconnect; retry timers retain backoff.
    if (!runtime.retryHandle && isOnline() && isCurrentMembershipRuntime(runtime)) {
      void runtime.db.collectionMembershipMutations.count().then((count) => {
        if (count && !runtime.retryHandle && isCurrentMembershipRuntime(runtime)) {
          void flushCollectionMemberships(runtime.getToken);
        }
      }).catch(() => {});
    }
  });
  return runtime.flushPromise;
}

async function drainWithLock(runtime: ReturnType<typeof membershipRuntime>): Promise<void> {
  // All tabs share Dexie: serialize requests before reading the queue head so
  // an older tab cannot apply an add after another tab acknowledged its undo.
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(`ava-reader:collection-membership:${runtime.db.name}`, () => drain(runtime));
  } else {
    await drain(runtime);
  }
}

async function drain(runtime: ReturnType<typeof membershipRuntime>): Promise<void> {
  if (!isOnline() || !isCurrentMembershipRuntime(runtime)) return;
  cancelRetry(runtime);
  try {
    while (isOnline() && isCurrentMembershipRuntime(runtime)) {
      const head = await runtime.db.collectionMembershipMutations.orderBy("queuedAt").first();
      if (!head) return;
      const token = await runtime.getToken();
      if (!isCurrentMembershipRuntime(runtime)) return;
      if (!token) { retry(runtime); return; }
      const snapshotCompletionRevision = await readCompletionRevision(runtime.db);
      const result = await sendMembership(head, token);
      if (!isCurrentMembershipRuntime(runtime)) return;
      if (result.kind === "retry") { retry(runtime); return; }
      await acknowledgeMembership(runtime.db, head, result.kind === "saved" ? result.payload : undefined, snapshotCompletionRevision);
      if (!isCurrentMembershipRuntime(runtime)) return;
      runtime.retryDelayMs = 0;
      await refreshFromDb();
      if (result.kind === "drop") reportMembershipDrop({ libraryItemId: head.libraryItemId, reason: result.reason });
      else void revalidateHome(runtime.getToken);
    }
  } catch {
    if (isCurrentMembershipRuntime(runtime)) retry(runtime);
  }
}

function retry(runtime: ReturnType<typeof membershipRuntime>): void {
  scheduleRetry(runtime, () => {
    if (isCurrentMembershipRuntime(runtime)) void flushCollectionMemberships(runtime.getToken);
  });
}
