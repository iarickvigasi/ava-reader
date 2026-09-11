import { getDb, type AvaReaderDB } from "../../../db";
import { cancelRetry } from "../../shared/bucket-core";
import type { GetToken, MembershipDropEvent } from "./types";

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
const drops = new Set<(event: MembershipDropEvent) => void>();
const lastDrops = new Map<string, MembershipDropEvent>();
let generation = 0;

export function membershipGeneration() { return generation; }
export function markMembershipChange() { generation += 1; }

export function membershipRuntime(getToken: GetToken): Runtime {
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

export function isCurrentMembershipRuntime(runtime: Runtime): boolean {
  return !runtime.stopped && runtime.db === getDb();
}

export function subscribeToCollectionMembershipDrops(
  listener: (event: MembershipDropEvent) => void,
): () => void {
  drops.add(listener);
  for (const event of lastDrops.values()) listener(event);
  return () => { drops.delete(listener); };
}

export function reportMembershipDrop(event: MembershipDropEvent): void {
  lastDrops.set(event.libraryItemId, event);
  for (const listener of drops) listener(event);
}

export function clearMembershipDrop(libraryItemId: string): void {
  lastDrops.delete(libraryItemId);
}

export function clearCollectionMembershipRuntime(): void {
  for (const runtime of runtimes) {
    runtime.stopped = true;
    cancelRetry(runtime);
    runtime.stopListening?.();
  }
  runtimes.clear();
  drops.clear();
  lastDrops.clear();
  markMembershipChange();
}
