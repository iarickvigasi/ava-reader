import { isOnline, subscribeToNetworkState } from "../../../net/net-state";
import { cancelRetry, scheduleRetry } from "../../shared/bucket-core";
import { currentLinkRuntime, linkRuntime } from "./bucket";
import { drainCatalogLinks } from "./drain";
import type { GetToken } from "./types";
export function flushCatalogLinks(getToken: GetToken): Promise<void> {
  const runtime = linkRuntime(getToken);
  if (!runtime.stopListening)
    runtime.stopListening = subscribeToNetworkState((online) => {
      if (online && currentLinkRuntime(runtime))
        void flushCatalogLinks(runtime.getToken);
    });
  if (runtime.flushPromise) return runtime.flushPromise;
  if (!isOnline() || !currentLinkRuntime(runtime)) return Promise.resolve();
  cancelRetry(runtime);
  const drain = async (): Promise<void> => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      await navigator.locks.request(
        `ava-reader:catalog-link:${runtime.db.name}`,
        () => drainCatalogLinks(runtime),
      );
    } else await drainCatalogLinks(runtime);
  };
  runtime.flushPromise = drain()
    .catch(() => {
      if (currentLinkRuntime(runtime))
        scheduleRetry(runtime, () => {
          if (currentLinkRuntime(runtime))
            void flushCatalogLinks(runtime.getToken);
        });
    })
    .finally(() => {
      runtime.flushPromise = null;
      if (
        currentLinkRuntime(runtime) &&
        !runtime.retryHandle &&
        [...runtime.records.values()].some((state) => state.pending)
      )
        scheduleRetry(runtime, () => {
          if (currentLinkRuntime(runtime))
            void flushCatalogLinks(runtime.getToken);
        });
    });
  return runtime.flushPromise;
}
