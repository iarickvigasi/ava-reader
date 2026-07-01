// Standalone background fetch of a book's AI comments into the offline cache.
// Mirrors the reader's initial AI-comments load (use-ai-comments.ts) without
// React — used by the cache primer for books the user marked offline.
// Best-effort: failures leave the cached snapshot and retry next pass.

import { getPublicApiBaseUrl } from "@/lib/api";

import { applyServerSnapshot } from "./sync";
import type { ServerAiComment } from "./types";

type GetToken = () => Promise<string | null>;

export async function revalidateAiComments(
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
      )}/ai-comments`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      },
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { items?: ServerAiComment[] };
    applyServerSnapshot(libraryItemId, apiBaseUrl, data.items ?? []);
  } catch {
    // Network blip — cached AI comments (if any) stand.
  }
}
