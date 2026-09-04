import { attachCoverBlob } from "./storage";

// Lazy write-through: once a personal-library cover has been shown from the
// network (no cached copy yet), fetch and store its bytes so the *next* view
// — even offline — is a cache hit instead of another network request. The
// row must already exist (from library metadata sync); if it doesn't yet,
// attachCoverBlob no-ops and the next successful sync makes this retry moot.
// Best-effort: a failed fetch (offline, dead URL) just means no write-through
// this time — the visible cover already succeeded or failed on its own.
export async function persistCoverFromNetwork(
  libraryItemId: string,
  src: string,
): Promise<void> {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      return;
    }
    await attachCoverBlob(libraryItemId, await response.blob());
  } catch {
    // Offline, CORS, aborted mid-flight — nothing to recover here.
  }
}
