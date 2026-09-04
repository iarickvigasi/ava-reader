import { attachAvatarBlob } from "./storage";

// Lazy write-through: once the profile photo has been shown from the network
// (no cached copy yet), fetch and store its bytes so the *next* view — even
// offline — is a cache hit instead of another network request. Mirrors
// buckets/book/persist-cover-blob.ts. Best-effort: a failed fetch (offline,
// CORS) just means no write-through this time.
export async function persistAvatarFromNetwork(avatarUrl: string): Promise<void> {
  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) {
      return;
    }
    await attachAvatarBlob(await response.blob());
  } catch {
    // Offline, CORS, aborted mid-flight — nothing to recover here.
  }
}
