import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DB_NAME, __resetDbForTests } from "@/features/offline/db";
import {
  __resetPreferencesSyncForTests,
  flushPreferences,
  markFieldDirty,
  readPreferences,
} from "@/features/offline/buckets/preferences";
import {
  __resetPreferencesStoreForTests,
  fetchPreferences,
  getCachedPreference,
  patchPreference,
  subscribePreference,
} from "./preferences-store";

vi.mock("@/features/offline/buckets/preferences", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/offline/buckets/preferences")>();
  return { ...original, markFieldDirty: vi.fn(original.markFieldDirty) };
});

const getToken = async () => "test-token";

beforeEach(() => {
  __resetDbForTests();
  __resetPreferencesStoreForTests();
  __resetPreferencesSyncForTests();
  vi.clearAllMocks();
  vi.stubGlobal("navigator", { onLine: false });
});

afterEach(async () => {
  __resetPreferencesStoreForTests();
  __resetPreferencesSyncForTests();
  __resetDbForTests();
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

it("keeps an offline goal after reopening and syncs only that field on reconnect", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
  vi.stubGlobal("fetch", fetchMock);
  const listener = vi.fn();
  subscribePreference("readingGoalMinutes", listener);

  await patchPreference(getToken, "readingGoalMinutes", 30);
  expect(getCachedPreference("readingGoalMinutes")).toBe(30);
  expect(listener).toHaveBeenCalledOnce();
  // The optimistic store starts this durable write in the background. Wait
  // for that actual write before simulating a restart, without timer polling.
  await vi.mocked(markFieldDirty).mock.results[0].value;
  expect((await readPreferences()).values.readingGoalMinutes).toBe(30);
  expect((await readPreferences()).dirtyFields).toEqual(["readingGoalMinutes"]);

  // A new app session must recover the queued value without network access.
  __resetPreferencesStoreForTests();
  __resetDbForTests();
  expect((await fetchPreferences(getToken)).readingGoalMinutes).toBe(30);
  expect(getCachedPreference("readingGoalMinutes")).toBe(30);

  vi.stubGlobal("navigator", { onLine: true });
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  await flushPreferences(getToken);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining("/api/me/preferences"),
    expect.objectContaining({ method: "PATCH", body: '{"readingGoalMinutes":30}' }),
  );
  expect((await readPreferences()).dirtyFields).toEqual([]);

  __resetPreferencesStoreForTests();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ readingGoalMinutes: 30, fontScale: 1.2 }),
  });
  expect((await fetchPreferences(getToken)).readingGoalMinutes).toBe(30);
  await flushPreferences(getToken);
  expect((await readPreferences()).values.fontScale).toBe(1.2);
});
