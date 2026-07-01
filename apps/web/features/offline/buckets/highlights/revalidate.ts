// Standalone background fetch of a book's highlights into the offline cache.
// Mirrors the reader's initial highlights load (use-highlights.ts) but without
// React — used by the cache primer to pre-populate annotations for books the
// user marked offline, so they render with no network. Best-effort: a failure
// leaves whatever was cached and the next pass / reader open retries.

import { getPublicApiBaseUrl } from "@/lib/api";

import { applyServerSnapshot, toHighlightRecord } from "./sync";

type GetToken = () => Promise<string | null>;

export async function revalidateHighlights(
  libraryItemId: string,
  getToken: GetToken,
): Promise<void> {
  const token = await getToken();
  if (!token) {
    return;
  }
  const apiBaseUrl = getPublicApiBaseUrl();
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/library/${encodeURIComponent(
        libraryItemId,
      )}/annotations`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      },
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      items?: Parameters<typeof toHighlightRecord>[0][];
    };
    const records = (data.items ?? []).map(toHighlightRecord);
    applyServerSnapshot(libraryItemId, apiBaseUrl, records);
  } catch {
    // Network blip — cached highlights (if any) stand.
  }
}
