import { persist, trackPersist } from "../../shared/bucket-core";
import { currentLinkRuntime, hydrateLinks, linkRuntime } from "./bucket";
import { EMPTY_LINK } from "./selectors";
import { linkMutationId } from "./id";
import { writeLink } from "./storage";
import { flushCatalogLinks } from "./sync";
import type { CatalogLink, GetToken } from "./types";
export async function setCatalogLink(
  id: string,
  link: CatalogLink | null,
  getToken: GetToken,
) {
  const runtime = linkRuntime(getToken);
  if (!runtime.hydrated) await hydrateLinks(runtime);
  if (!currentLinkRuntime(runtime)) return;
  const previous = runtime.records.get(id) ?? EMPTY_LINK;
  const state = {
    ...previous,
    pending: {
      mutationId: linkMutationId(),
      version: runtime.records.get(id)?.serverVersion ?? 0,
      link,
    },
    error: "",
  };
  runtime.records.set(id, state);
  persist(runtime);
  trackPersist(runtime, () => writeLink(runtime.db, id, state));
  try {
    await runtime.pendingPersist;
  } catch (error) {
    if (
      currentLinkRuntime(runtime) &&
      runtime.records.get(id)?.pending?.mutationId === state.pending.mutationId
    ) {
      runtime.records.set(id, {
        ...previous,
        error: "Could not save the link on this device.",
      });
      persist(runtime);
    }
    throw error;
  }
  if (currentLinkRuntime(runtime)) void flushCatalogLinks(getToken);
}
