import { getPublicApiBaseUrl } from "@/lib/api";
import type { CatalogLink, LinkState, LinkResult } from "./types";
export async function sendLink(
  id: string,
  pending: NonNullable<LinkState["pending"]>,
  token: string,
): Promise<LinkResult> {
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(id)}/catalog-link`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutationId: pending.mutationId,
        version: pending.version,
        workId: pending.link?.workId ?? null,
      }),
    },
  );
  if ([400, 403, 404, 409].includes(response.status)) {
    const conflict = (await response.json().catch(() => null)) as {
      link: CatalogLink | null;
      version: number;
    } | null;
    return {
      kind: "drop",
      error:
        "Link could not be saved. Your previous link was kept; choose the book again.",
      accepted:
        conflict && Number.isSafeInteger(conflict.version) && "link" in conflict
          ? conflict
          : undefined,
    };
  }
  if (!response.ok) throw new Error("Link synchronization will retry");
  return {
    kind: "saved" as const,
    ...((await response.json()) as {
      link: CatalogLink | null;
      version: number;
    }),
  };
}
