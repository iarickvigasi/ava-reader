import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { loadOwnedResource } from "./owned-resource";

type ResourceState = { src: string; status: "ready" | "failed" | "loading" };
type Input = {
  apiBase: string;
  getToken: () => Promise<string>;
  isCurrent: () => boolean;
};
type ReadyPayload = Extract<ReaderStatusPayload, { status: "READY" }>;

// Session-local availability; never writes accepted content or offline completion.
export function createResourceRecovery(payload: ReadyPayload, input: Input) {
  let access = input;
  let active = true;
  let snapshot: Record<string, ResourceState> = Object.fromEntries(
    (payload.readerPackage?.book.resources ?? []).map((resource) => [
      resource.id,
      {
        src: payload.resourceUrls?.[resource.id] ?? "",
        status: payload.resourceUrls?.[resource.id] ? "ready" : "failed",
      },
    ]),
  );
  const listeners = new Set<() => void>();
  const pending = new Map<string, AbortController>();
  const publish = (id: string, value: ResourceState) => {
    snapshot = { ...snapshot, [id]: value };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    setAccess(next: Input) {
      access = next;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    activate() {
      active = true;
    },
    deactivate() {
      active = false;
      for (const controller of pending.values()) controller.abort();
      for (const id of pending.keys())
        publish(id, { src: "", status: "failed" });
      pending.clear();
    },
    canRetry: (id: string) => Boolean(payload.resourceRequests?.[id]),
    fail(id: string) {
      if (active && snapshot[id] && !pending.has(id))
        publish(id, { src: "", status: "failed" });
    },
    async retry(id: string): Promise<boolean> {
      const resource = payload.readerPackage?.book.resources.find(
        (r) => r.id === id,
      );
      const url = payload.resourceRequests?.[id];
      if (
        !active ||
        !access.isCurrent() ||
        pending.has(id) ||
        !resource ||
        !url
      )
        return false;
      const controller = new AbortController();
      pending.set(id, controller);
      const current = () =>
        active &&
        access.isCurrent() &&
        pending.get(id) === controller &&
        !controller.signal.aborted;
      publish(id, { src: "", status: "loading" });
      try {
        const token = await access.getToken();
        if (!current()) return false;
        const src = await loadOwnedResource(resource, url, {
          token,
          apiBase: access.apiBase,
          signal: controller.signal,
        });
        if (!current()) return false;
        publish(id, { src, status: "ready" });
        return true;
      } catch {
        // Integrity/ownership errors refuse the bytes as well; UI exposes no private detail.
        return false;
      } finally {
        if (pending.get(id) === controller) {
          pending.delete(id);
          if (active && snapshot[id]?.status === "loading")
            publish(id, { src: "", status: "failed" });
        }
      }
    },
  };
}
export type ReaderResourceRecovery = ReturnType<typeof createResourceRecovery>;
