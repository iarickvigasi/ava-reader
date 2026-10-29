import { isOnline } from "../../../net/net-state";
import { persist } from "../../shared/bucket-core";
import { currentLinkRuntime } from "./bucket";
import { readLinks, writeLink } from "./storage";
import { sendLink } from "./send";
import type { LinkRuntime } from "./types";
export async function drainCatalogLinks(runtime: LinkRuntime) {
  await runtime.pendingPersist;
  while (currentLinkRuntime(runtime) && isOnline()) {
    const head = (await readLinks(runtime.db)).find(
      ([, state]) => state.pending,
    );
    if (!head) return;
    const [id, state] = head;
    const token = await runtime.getToken();
    if (!token || !currentLinkRuntime(runtime)) return;
    const result = await sendLink(id, state.pending!, token);
    if (!currentLinkRuntime(runtime)) return;
    await runtime.pendingPersist;
    await runtime.db.transaction("rw", runtime.db.meta, async () => {
      const current = (await readLinks(runtime.db)).find(
        ([key]) => key === id,
      )?.[1];
      if (!current) return;
      const sameIntent =
        current.pending?.mutationId === state.pending?.mutationId;
      const accepted = result.kind === "saved" ? result : result.accepted;
      const serverVersion = accepted?.version ?? current.serverVersion ?? 0;
      const next = {
        snapshot: accepted ? accepted.link : current.snapshot,
        serverVersion,
        pending: sameIntent
          ? null
          : current.pending
            ? { ...current.pending, version: serverVersion }
            : null,
        error:
          sameIntent && result.kind === "drop" ? result.error : current.error,
      };
      await writeLink(runtime.db, id, next);
      if (
        runtime.records.get(id)?.pending?.mutationId ===
        current.pending?.mutationId
      )
        runtime.records.set(id, next);
    });
    if (!currentLinkRuntime(runtime)) return;
    runtime.retryDelayMs = 0;
    persist(runtime);
  }
}
