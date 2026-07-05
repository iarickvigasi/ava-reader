// Flushes locally-dirty reading progress up to the server. A dirty row is a
// position the user advanced (often offline) that the reader itself never
// managed to PATCH. Mounted app-wide via ProgressSyncRunner and kicked on
// reconnect, so offline reading syncs even without reopening the book. Mirrors
// the preferences / offline-intent dirty-then-flush model: single-flight,
// online-guarded, last-write-wins; a dirty row survives a failed pass and
// retries on the next tick.

import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReaderLocator, ReaderProgressPayload } from "@/lib/api-types";

import { listDirtyProgress, markProgressSyncedIfUnchanged } from "./storage";

type GetToken = () => Promise<string | null>;

let flushing: Promise<{ synced: number }> | null = null;

export async function flushDirtyProgress(
  getToken: GetToken,
): Promise<{ synced: number }> {
  if (flushing) {
    return flushing;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0 };
  }
  flushing = doFlush(getToken).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(getToken: GetToken): Promise<{ synced: number }> {
  const dirty = await listDirtyProgress();
  if (dirty.length === 0) {
    return { synced: 0 };
  }
  let synced = 0;
  for (const row of dirty) {
    if (!row.locator) {
      continue;
    }
    const token = await getToken();
    if (!token) {
      break; // no auth right now — leave the rest dirty for the next tick
    }
    const ok = await patchProgress(
      token,
      row.libraryItemId,
      row.locator,
      // The offline read moment, not the flush time — so the server's
      // most-recent-reading-wins compare uses when the user actually read.
      row.lastLocalUpdateAt,
    );
    if (ok) {
      synced += 1;
    }
    // A failed PATCH leaves the row dirty; the next reconnect tick retries.
  }
  return { synced };
}

async function patchProgress(
  token: string,
  libraryItemId: string,
  locator: ReaderLocator,
  readAt: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
        libraryItemId,
      )}/reader/progress`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ locator, readAt }),
      },
    );
    if (!response.ok) {
      return false;
    }
    const server = (await response.json()) as ReaderProgressPayload;
    // Adopt the server's canonical position — under most-recent-wins it may be
    // another device's newer locator (our stale write was rejected).
    await markProgressSyncedIfUnchanged(libraryItemId, locator, {
      locator: server.locator,
      completionPercent: server.completionPercent,
      lastReadAt: server.lastReadAt,
    });
    return true;
  } catch {
    return false;
  }
}

// Test-only: clear the module flush guard so each case starts fresh.
export function __resetProgressSyncForTests() {
  flushing = null;
}
