import { getPublicApiBaseUrl } from "@/lib/api";
import { currentLinkRuntime } from "./bucket";
import { writeLink } from "./storage";
import { persist, trackPersist } from "../../shared/bucket-core";
import type { CatalogLink, LinkRuntime } from "./types";
export async function refreshWorkLinks(runtime: LinkRuntime, workId: string) {
  const version = runtime.version;
  const token = await runtime.getToken();
  if (!token || !currentLinkRuntime(runtime)) return;
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/private-catalog-links?workId=${encodeURIComponent(workId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    },
  );
  if (!response.ok) return;
  const rows = (await response.json()) as {
    id: string;
    catalogLink: CatalogLink;
    catalogLinkVersion: number;
  }[];
  if (!currentLinkRuntime(runtime) || runtime.version !== version) return;
  const incoming = new Map(rows.map((row) => [row.id, row]));
  const ids = new Set([
    ...incoming.keys(),
    ...[...runtime.records]
      .filter(([, state]) => state.snapshot?.workId === workId)
      .map(([id]) => id),
  ]);
  for (const id of ids) {
    const previous = runtime.records.get(id);
    if (previous?.pending) continue;
    const state = {
      snapshot: incoming.get(id)?.catalogLink ?? null,
      serverVersion:
        incoming.get(id)?.catalogLinkVersion ?? previous?.serverVersion ?? 0,
      pending: null,
      error: previous?.error ?? "",
    };
    runtime.records.set(id, state);
    trackPersist(runtime, () => writeLink(runtime.db, id, state));
  }
  persist(runtime);
}
