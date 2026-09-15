import "fake-indexeddb/auto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.stubGlobal("navigator", { onLine: true });

import { DB_NAME, __resetDbForTests } from "../../db";
import { markFieldDirty, readPreferences } from "./storage";
import { __resetPreferencesSyncForTests, flushPreferences } from "./sync";

beforeEach(() => {
  __resetDbForTests();
  __resetPreferencesSyncForTests();
});

afterEach(async () => {
  __resetDbForTests();
  __resetPreferencesSyncForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

const TOKEN = async () => "token";

describe("flushPreferences", () => {
  it("does nothing when there are no dirty fields", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await flushPreferences(TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PATCHes coalesced body containing only dirty fields", async () => {
    await markFieldDirty("theme", "dark");
    await markFieldDirty("fontScale", 1.2);
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await flushPreferences(TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // vi.fn() infers `[]` for the args tuple when constructed with a zero-arg
    // factory; cast through `unknown` to read the recorded RequestInit.
    const recorded = (
      fetchMock.mock.calls as unknown as Array<[unknown, RequestInit]>
    )[0]!;
    const body = JSON.parse(recorded[1].body as string) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ theme: "dark", fontScale: 1.2 });
  });

  it("strips synced fields from the dirty list on 2xx", async () => {
    await markFieldDirty("theme", "dark");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200 })),
    );
    await flushPreferences(TOKEN);
    const out = await readPreferences();
    expect(out.dirtyFields).toEqual([]);
  });

  it("keeps a newer goal dirty when an earlier flush succeeds, then syncs it", async () => {
    await markFieldDirty("readingGoalMinutes", 30);
    await markFieldDirty("fontScale", 1.2);
    let startFirst!: () => void;
    let finishFirst!: (response: { ok: boolean; status: number }) => void;
    const firstStarted = new Promise<void>((resolve) => { startFirst = resolve; });
    const firstResponse = new Promise<{ ok: boolean; status: number }>((resolve) => {
      finishFirst = resolve;
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => {
        startFirst();
        return firstResponse;
      })
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const firstFlush = flushPreferences(TOKEN);
    await firstStarted;
    await markFieldDirty("readingGoalMinutes", 45);
    finishFirst({ ok: true, status: 200 });
    await firstFlush;

    const pending = await readPreferences();
    expect(pending.values.readingGoalMinutes).toBe(45);
    expect(pending.dirtyFields).toEqual(["readingGoalMinutes"]);

    await flushPreferences(TOKEN);

    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([
      { readingGoalMinutes: 30, fontScale: 1.2 },
      { readingGoalMinutes: 45 },
    ]);
    const synced = await readPreferences();
    expect(synced.values.readingGoalMinutes).toBe(45);
    expect(synced.dirtyFields).toEqual([]);
  });

  it("keeps the dirty list intact on 5xx — next online tick retries", async () => {
    await markFieldDirty("theme", "dark");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await flushPreferences(TOKEN);
    const out = await readPreferences();
    expect(out.dirtyFields).toEqual(["theme"]);
  });

  it("keeps the dirty list intact on a network error", async () => {
    await markFieldDirty("theme", "dark");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await flushPreferences(TOKEN);
    const out = await readPreferences();
    expect(out.dirtyFields).toEqual(["theme"]);
  });

  it("bails when navigator.onLine is false", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await markFieldDirty("theme", "dark");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await flushPreferences(TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
