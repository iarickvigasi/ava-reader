import { getDb } from "../../../db";
import { cancelRetry } from "../../shared/bucket-core";
import { readLinks } from "./storage";
import type { GetToken, LinkRuntime } from "./types";
const runtimes = new Set<LinkRuntime>();
export function linkRuntime(getToken: GetToken): LinkRuntime {
  const db = getDb();
  const existing = [...runtimes].find((item) => item.db === db);
  if (existing) {
    existing.getToken = getToken;
    return existing;
  }
  const runtime: LinkRuntime = {
    db,
    getToken,
    records: new Map(),
    listeners: new Set(),
    version: 0,
    pendingPersist: Promise.resolve(),
    flushPromise: null,
    retryHandle: null,
    retryDelayMs: 0,
    stopped: false,
    hydrated: false,
  };
  runtimes.add(runtime);
  return runtime;
}
export const currentLinkRuntime = (runtime: LinkRuntime) =>
  !runtime.stopped && runtime.db === getDb();
export async function hydrateLinks(runtime: LinkRuntime) {
  const rows = await readLinks(runtime.db);
  if (!currentLinkRuntime(runtime)) return;
  for (const [id, state] of rows)
    if (!runtime.records.has(id)) runtime.records.set(id, state);
  runtime.hydrated = true;
  runtime.version += 1;
  for (const listener of runtime.listeners) listener();
}
export function clearCatalogLinkRuntime() {
  for (const runtime of runtimes) {
    runtime.stopped = true;
    cancelRetry(runtime);
    runtime.stopListening?.();
    runtime.listeners.clear();
  }
  runtimes.clear();
}
