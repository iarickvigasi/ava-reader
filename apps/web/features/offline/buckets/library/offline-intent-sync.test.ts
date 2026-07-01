import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("navigator", { onLine: true });

import { DB_NAME, __resetDbForTests, getDb, type LibraryItemRow } from "../../db";
import {
  __resetOfflineIntentSyncForTests,
  flushOfflineIntents,
  promoteBookOffline,
  releaseBookOffline,
  setBookOfflineIntent,
} from "./offline-intent-sync";

const TOKEN = async () => "token";

function row(id: string): LibraryItemRow {
  return {
    libraryItemId: id,
    slug: id,
    title: id,
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB" as LibraryItemRow["primaryFormat"],
    lastReadAt: null,
    offlineRequested: false,
    offlineRequestedDirty: false,
    coverBlob: null,
    savedOffline: false,
    savedAutomatically: false,
    savedAt: null,
    serverUpdatedAt: null,
  };
}

beforeEach(async () => {
  __resetDbForTests();
  __resetOfflineIntentSyncForTests();
  vi.stubGlobal("navigator", { onLine: true });
  await getDb().libraryItems.put(row("a"));
});

afterEach(async () => {
  __resetDbForTests();
  __resetOfflineIntentSyncForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("setBookOfflineIntent + flushOfflineIntents", () => {
  it("optimistically records the intent and PATCHes it while online", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const applied = await setBookOfflineIntent("a", true, TOKEN);
    await flushOfflineIntents(TOKEN); // awaits the in-flight flush

    expect(applied).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/library/a/offline"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ requested: true }),
      }),
    );
    const saved = await getDb().libraryItems.get("a");
    expect(saved?.offlineRequested).toBe(true);
    expect(saved?.offlineRequestedDirty).toBe(false); // cleared on success
  });

  it("returns false when the book isn't cached yet", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await setBookOfflineIntent("missing", true, TOKEN)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays dirty while offline and syncs on the next online flush", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: false });

    await setBookOfflineIntent("a", true, TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
    let saved = await getDb().libraryItems.get("a");
    expect(saved?.offlineRequested).toBe(true); // optimistic
    expect(saved?.offlineRequestedDirty).toBe(true); // not yet synced

    vi.stubGlobal("navigator", { onLine: true });
    await flushOfflineIntents(TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    saved = await getDb().libraryItems.get("a");
    expect(saved?.offlineRequestedDirty).toBe(false);
  });

  it("leaves the row dirty when the server rejects the toggle", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await setBookOfflineIntent("a", true, TOKEN);
    await flushOfflineIntents(TOKEN);

    const saved = await getDb().libraryItems.get("a");
    expect(saved?.offlineRequestedDirty).toBe(true); // retried next online tick
  });

  it("promoteBookOffline makes an auto-saved book sticky + syncs intent", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    // Seed an auto-saved row: content cached implicitly, not yet explicit.
    await getDb().libraryItems.put({
      ...row("a"),
      savedOffline: false,
      savedAutomatically: true,
    });

    const applied = await promoteBookOffline("a", TOKEN);
    await flushOfflineIntents(TOKEN);

    expect(applied).toBe(true);
    const saved = await getDb().libraryItems.get("a");
    expect(saved?.savedOffline).toBe(true); // now sticky — no longer evictable
    expect(saved?.offlineRequested).toBe(true);
    expect(saved?.offlineRequestedDirty).toBe(false); // synced
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/library/a/offline"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("promoteBookOffline returns false when the book isn't cached", async () => {
    expect(await promoteBookOffline("missing", TOKEN)).toBe(false);
  });

  it("releaseBookOffline clears the keep flags WITHOUT deleting (back to auto)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    // Seed an explicitly-kept row.
    await getDb().libraryItems.put({
      ...row("a"),
      savedOffline: true,
      offlineRequested: true,
    });

    const applied = await releaseBookOffline("a", TOKEN);
    await flushOfflineIntents(TOKEN);

    expect(applied).toBe(true);
    const saved = await getDb().libraryItems.get("a");
    expect(saved).toBeDefined(); // row still here — nothing deleted
    expect(saved?.savedOffline).toBe(false); // no longer sticky
    expect(saved?.savedAutomatically).toBe(true); // evictable auto-cache again
    expect(saved?.offlineRequested).toBe(false);
    expect(saved?.offlineRequestedDirty).toBe(false); // synced
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/library/a/offline"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ requested: false }),
      }),
    );
  });
});
