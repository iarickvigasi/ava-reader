import { getPublicApiBaseUrl } from "@/lib/api";
import { currentLinkRuntime } from "./bucket";
import { EMPTY_LINK } from "./selectors";
import { writeLink } from "./storage";
import { persist, trackPersist } from "../../shared/bucket-core";
import type { CatalogLink, LinkRuntime } from "./types";
export async function refreshCatalogLink(runtime: LinkRuntime, id: string) {
  const version = runtime.version;
  const token = await runtime.getToken();
  if (!token || !currentLinkRuntime(runtime)) return;
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(id)}/catalog-link`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return;
  const { link, version: serverVersion } = (await response.json()) as {
    link: CatalogLink | null;
    version: number;
  };
  if (!currentLinkRuntime(runtime) || runtime.version !== version) return;
  const current = runtime.records.get(id) ?? EMPTY_LINK;
  if (current.pending) return;
  const state = { ...current, snapshot: link, serverVersion };
  runtime.records.set(id, state);
  persist(runtime);
  trackPersist(runtime, () => writeLink(runtime.db, id, state));
  await runtime.pendingPersist;
}
