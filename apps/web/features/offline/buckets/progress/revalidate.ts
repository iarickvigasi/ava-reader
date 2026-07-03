// Standalone background fetch of a book's reading progress into the offline
// progress bucket. Mirrors the highlights/ai-comments revalidators — used by
// the cache primer so a book primed on a fresh device resumes on the last-read
// page instead of chapter 1 (see specs/11-cache-priming,
// specs/5-reading-sessions-progress). Best-effort: a failure leaves whatever
// was cached and the next pass / reader open retries.

import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReaderProgressPayload } from "@/lib/api-types";

import { readProgress, writeProgress } from "./storage";

type GetToken = () => Promise<string | null>;

export async function revalidateProgress(
  libraryItemId: string,
  getToken: GetToken,
): Promise<void> {
  // A dirty row is local progress the user is ahead on but hasn't synced (read
  // offline). The server is behind it, so pulling server truth would rewind the
  // reader — leave it for the reader's own PATCH to reconcile.
  const prior = await readProgress(libraryItemId);
  if (prior?.dirty) {
    return;
  }

  const token = await getToken();
  if (!token) {
    return;
  }
  const apiBaseUrl = getPublicApiBaseUrl();
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/library/${encodeURIComponent(
        libraryItemId,
      )}/reader/progress`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as ReaderProgressPayload;
    await writeProgress({
      libraryItemId,
      locator: data.locator,
      completionPercent: data.completionPercent,
      lastReadAt: data.lastReadAt,
      dirty: false,
    });
  } catch {
    // Network blip — cached progress (if any) stands.
  }
}
