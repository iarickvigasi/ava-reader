import "fake-indexeddb/auto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Match the in-session minimums the bucket relies on (navigator.onLine for
// the flush gate). `window` is provided by fake-indexeddb's worker
// environment shim plus vitest's default globals.
vi.stubGlobal("navigator", { onLine: true });

import { DB_NAME, __resetDbForTests, getDb } from "../../db";

import {
  __resetHighlightsBucketsForTests,
  awaitHighlightsPersistDrain,
  getHighlightsBucket,
  setBucketAuth,
} from "./bucket";
import { applyServerSnapshot, toHighlightRecord } from "./sync";
import { enqueueDelete, enqueueUpsert } from "./mutations";
import { selectStableHighlights } from "./selectors";
import type { HighlightRecord } from "./types";

const LIBRARY_ID = "lib-1";
const API = "http://localhost:4000";

const sampleLocator = {
  chapterId: "ch-1",
  startBlockId: "b1",
  startOffset: 0,
  endBlockId: "b1",
  endOffset: 10,
  contextBefore: "",
  contextAfter: "",
};

beforeEach(() => {
  __resetDbForTests();
  __resetHighlightsBucketsForTests();
});

afterEach(async () => {
  __resetDbForTests();
  __resetHighlightsBucketsForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

// Awaits the bucket's chained pendingPersist promise (every fire-and-forget
// Dexie write goes through trackPersist), then a microtask for good measure.
// Deterministic in a way that polling setTimeouts isn't.
async function drain() {
  await awaitHighlightsPersistDrain(LIBRARY_ID);
  await Promise.resolve();
}

describe("highlights bucket — basic CRUD", () => {
  it("applyServerSnapshot writes the snapshot to Dexie and renders it via the selector", async () => {
    const record: HighlightRecord = {
      id: "h1",
      excerpt: "Hello",
      color: "apricot",
      locator: sampleLocator,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    applyServerSnapshot(LIBRARY_ID, API, [record]);
    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    expect(selectStableHighlights(bucket)).toEqual([record]);
    // Wait for the void replaceSnapshot to settle.
    await drain();
    const db = getDb();
    const dexieRows = await db.highlights
      .where("libraryItemId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieRows).toHaveLength(1);
    expect(dexieRows[0]?.id).toBe("h1");
  });

  it("enqueueUpsert writes a pending mutation row to Dexie and reflects it in the selector", async () => {
    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "Local",
      color: "jade",
      locator: sampleLocator,
    });
    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    const selected = selectStableHighlights(bucket);
    expect(selected[0]?.color).toBe("jade");

    await drain();
    const db = getDb();
    const rows = await db.highlightMutations
      .where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("upsert");
    expect(rows[0]?.highlightId).toBe("h1");
  });

  it("enqueueUpsert coalesces — only one pending mutation per highlight id", async () => {
    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "first",
      color: "jade",
      locator: null,
    });
    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "second",
      color: "rose",
      locator: null,
    });
    await drain();
    const db = getDb();
    const rows = await db.highlightMutations
      .where("highlightId")
      .equals("h1")
      .toArray();
    expect(rows).toHaveLength(1);
    expect((rows[0]?.payload as { highlightColor: string }).highlightColor).toBe(
      "rose",
    );
  });

  it("enqueueDelete drops both the pending upsert and any record when the highlight was never synced", async () => {
    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "Local",
      color: "jade",
      locator: null,
    });
    enqueueDelete(LIBRARY_ID, API, "h1");
    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    expect(selectStableHighlights(bucket)).toEqual([]);
    await drain();
    const db = getDb();
    const rows = await db.highlightMutations
      .where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(0);
  });

  it("enqueueDelete keeps a pending delete when the highlight was already on the server", async () => {
    const record: HighlightRecord = {
      id: "h1",
      excerpt: "Server",
      color: "apricot",
      locator: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    applyServerSnapshot(LIBRARY_ID, API, [record]);
    enqueueDelete(LIBRARY_ID, API, "h1");
    await drain();
    const db = getDb();
    const rows = await db.highlightMutations
      .where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("delete");
  });
});

describe("highlights bucket — sync semantics", () => {
  it("flushBucket replays a pending upsert, writes the server-confirmed row to Dexie, drains the queue", async () => {
    const server: HighlightRecord = {
      id: "h1",
      excerpt: "Local",
      color: "jade",
      locator: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ item: { ...server, highlightColor: server.color } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    setBucketAuth(LIBRARY_ID, API, async () => "token");

    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "Local",
      color: "jade",
      locator: null,
    });

    // enqueueUpsert fires a void flushBucket internally; wait for it to
    // settle rather than calling flushBucket again (the second call would
    // be a no-op via the flushing-claim guard).
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    expect(bucket.state.pending).toEqual([]);
    expect(bucket.state.snapshot.map((row) => row.id)).toEqual(["h1"]);

    await drain();
    const db = getDb();
    const dexieSnapshot = await db.highlights
      .where("libraryItemId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieSnapshot).toHaveLength(1);
    const dexieQueue = await db.highlightMutations
      .where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieQueue).toHaveLength(0);
  });

  it("flushBucket retries on a 503 — queue stays intact", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);
    setBucketAuth(LIBRARY_ID, API, async () => "token");

    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "L",
      color: "rose",
      locator: null,
    });

    await drain();
    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    expect(bucket.state.pending).toHaveLength(1);
    const db = getDb();
    const dexieQueue = await db.highlightMutations
      .where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieQueue).toHaveLength(1);
  });

  it("flushBucket drops on a 422 and clears the Dexie row", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ message: "bad shape" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    setBucketAuth(LIBRARY_ID, API, async () => "token");

    enqueueUpsert(LIBRARY_ID, API, {
      id: "h1",
      excerpt: "L",
      color: "rose",
      locator: null,
    });

    await drain();
    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    expect(bucket.state.pending).toEqual([]);
    const db = getDb();
    const dexieQueue = await db.highlightMutations
      .where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieQueue).toHaveLength(0);
  });
});

describe("highlights bucket — hydrate from Dexie", () => {
  it("a fresh bucket reads its initial state from Dexie", async () => {
    // Seed Dexie directly without going through the bucket.
    const db = getDb();
    await db.highlights.put({
      libraryItemId: LIBRARY_ID,
      id: "h1",
      excerpt: "from-disk",
      color: "mauve",
      locator: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    await db.highlightMutations.put({
      mutationId: "h2",
      scopeId: LIBRARY_ID,
      kind: "upsert",
      highlightId: "h2",
      payload: { excerpt: "pending", highlightColor: "sky", locator: null },
      queuedAt: "2026-01-02T00:00:00Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });

    const bucket = getHighlightsBucket(LIBRARY_ID, API);
    await bucket.hydratedPromise;
    expect(bucket.state.snapshot.map((row) => row.id)).toEqual(["h1"]);
    expect(bucket.state.pending.map((m) => m.id)).toEqual(["h2"]);
  });
});

describe("toHighlightRecord — server shape conversion", () => {
  it("falls back to apricot when the server returned a null colour", () => {
    expect(
      toHighlightRecord({
        id: "h",
        excerpt: "x",
        highlightColor: null,
        locator: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }).color,
    ).toBe("apricot");
  });
});
