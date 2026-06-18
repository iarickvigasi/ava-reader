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

import { DB_NAME, __resetDbForTests, getDb } from "../../db";

import {
  __resetAiCommentsBucketsForTests,
  awaitAiCommentsPersistDrain,
  getAiCommentsBucket,
  setBucketAuth,
} from "./bucket";
import { applyServerSnapshot } from "./sync";
import { enqueueDelete, enqueueGenerate } from "./mutations";
import { selectStableAiComments } from "./selectors";
import type { ServerAiComment } from "./types";

const LIBRARY_ID = "lib-1";
const API = "http://localhost:4000";

beforeEach(() => {
  __resetDbForTests();
  __resetAiCommentsBucketsForTests();
});

afterEach(async () => {
  __resetDbForTests();
  __resetAiCommentsBucketsForTests();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

async function drain() {
  await awaitAiCommentsPersistDrain(LIBRARY_ID);
  await Promise.resolve();
}

describe("ai-comments bucket — snapshot + selector", () => {
  it("applyServerSnapshot mirrors the snapshot to Dexie and renders via selector", async () => {
    const server: ServerAiComment = {
      id: "c1",
      kind: "TRANSLATE",
      sourceText: "hola",
      body: "hello",
      targetLang: "English",
      locator: null,
      createdAt: "2026-04-12T10:00:00.000Z",
    };
    applyServerSnapshot(LIBRARY_ID, API, [server]);
    const bucket = getAiCommentsBucket(LIBRARY_ID, API);
    const view = selectStableAiComments(bucket);
    expect(view).toHaveLength(1);
    expect(view[0]?.status).toBe("ready");
    expect(view[0]?.body).toBe("hello");
    await drain();
    const dexieRows = await getDb()
      .aiComments.where("libraryItemId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieRows).toHaveLength(1);
  });
});

describe("ai-comments bucket — mutations", () => {
  it("enqueueGenerate adds a queued placeholder to the selector view", async () => {
    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.translate",
      id: "client-1",
      payload: { text: "hola", targetLang: "English" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    const view = selectStableAiComments(getAiCommentsBucket(LIBRARY_ID, API));
    expect(view).toHaveLength(1);
    expect(view[0]?.status).toBe("queued");
    expect(view[0]?.body).toBe("");
    expect(view[0]?.kind).toBe("TRANSLATE");
    expect(view[0]?.targetLang).toBe("English");
    await drain();
    const rows = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("generate.translate");
  });

  it("coalesces a repeated identical generate (same content, fresh id) into one queued comment", async () => {
    // Reproduces the offline duplication bug: re-mounting the AI toolbox while
    // offline re-runs its enqueue effect, each time with a brand-new client id
    // (generateAiCommentId) but the same selection + kind. These must collapse
    // to a single queued comment, not pile up placeholders.
    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.explain",
      id: "client-a",
      payload: { text: "lorem ipsum" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.explain",
      id: "client-b",
      payload: { text: "lorem ipsum" },
      locator: null,
      queuedAt: "2026-04-12T11:00:01.000Z",
    });

    const view = selectStableAiComments(getAiCommentsBucket(LIBRARY_ID, API));
    expect(view).toHaveLength(1);

    await drain();
    const rows = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(1);
  });

  it("does not coalesce generates that differ by target language", async () => {
    // Guard against over-coalescing: same source text, different target lang
    // are distinct comments (the server's sourceHash includes targetLang).
    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.translate",
      id: "client-c",
      payload: { text: "hola", targetLang: "English" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.translate",
      id: "client-d",
      payload: { text: "hola", targetLang: "French" },
      locator: null,
      queuedAt: "2026-04-12T11:00:01.000Z",
    });

    const view = selectStableAiComments(getAiCommentsBucket(LIBRARY_ID, API));
    expect(view).toHaveLength(2);
    await drain();
  });

  it("enqueueDelete on a never-synced queued generate collapses both — nothing to send", async () => {
    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.etymology",
      id: "client-2",
      payload: { text: "telos" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    enqueueDelete(LIBRARY_ID, API, "client-2");
    const view = selectStableAiComments(getAiCommentsBucket(LIBRARY_ID, API));
    expect(view).toEqual([]);
    await drain();
    const rows = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(0);
  });

  it("enqueueDelete keeps a delete row when the comment is already on the server", async () => {
    applyServerSnapshot(LIBRARY_ID, API, [
      {
        id: "server-1",
        kind: "EXPLAIN",
        sourceText: "x",
        body: "y",
        targetLang: null,
        locator: null,
        createdAt: "2026-04-12T10:00:00.000Z",
      },
    ]);
    await drain();
    enqueueDelete(LIBRARY_ID, API, "server-1");
    await drain();
    const rows = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("delete");
  });
});

describe("ai-comments bucket — sync streaming", () => {
  it("drains a queued generate: streams the body chunk by chunk and flips status to ready", async () => {
    const chunks = ["Hello", " ", "world"];
    const reader = {
      _i: 0,
      async read() {
        const value = chunks[this._i++];
        if (value === undefined) {
          return { done: true, value: undefined };
        }
        return { done: false, value: new TextEncoder().encode(value) };
      },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { getReader: () => reader },
    }));
    vi.stubGlobal("fetch", fetchMock);
    setBucketAuth(LIBRARY_ID, API, async () => "token");

    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.translate",
      id: "client-3",
      payload: { text: "hola", targetLang: "English" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    await drain();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const view = selectStableAiComments(getAiCommentsBucket(LIBRARY_ID, API));
    expect(view).toHaveLength(1);
    expect(view[0]?.body).toBe("Hello world");
    expect(view[0]?.status).toBe("ready");
    const dexieRows = await getDb()
      .aiComments.where("libraryItemId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(dexieRows[0]?.body).toBe("Hello world");
    expect(dexieRows[0]?.status).toBe("ready");
    const queue = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(queue).toHaveLength(0);
  });

  it("retries on 503 — queue stays intact", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);
    setBucketAuth(LIBRARY_ID, API, async () => "token");

    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.explain",
      id: "client-4",
      payload: { text: "x" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    await drain();

    const queue = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(queue).toHaveLength(1);
  });

  it("drops + marks failed on 422", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ message: "bad shape" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    setBucketAuth(LIBRARY_ID, API, async () => "token");

    enqueueGenerate(LIBRARY_ID, API, {
      kind: "generate.etymology",
      id: "client-5",
      payload: { text: "telos" },
      locator: null,
      queuedAt: "2026-04-12T11:00:00.000Z",
    });
    await drain();

    const view = selectStableAiComments(getAiCommentsBucket(LIBRARY_ID, API));
    // Placeholder row is kept but marked failed (matches the user spec —
    // failed comments show in the panel dimmed, not hidden).
    expect(view).toHaveLength(1);
    expect(view[0]?.status).toBe("failed");
    const queue = await getDb()
      .aiCommentMutations.where("scopeId")
      .equals(LIBRARY_ID)
      .toArray();
    expect(queue).toHaveLength(0);
  });
});

describe("ai-comments bucket — hydrate from Dexie", () => {
  it("a fresh bucket reads its initial state from Dexie", async () => {
    const db = getDb();
    await db.aiComments.put({
      libraryItemId: LIBRARY_ID,
      id: "from-disk",
      kind: "TRANSLATE",
      sourceText: "x",
      body: "y",
      targetLang: "en",
      locator: null,
      createdAt: "2026-04-12T10:00:00.000Z",
      status: "ready",
    });
    await db.aiCommentMutations.put({
      mutationId: "pending-1",
      scopeId: LIBRARY_ID,
      kind: "generate.translate",
      commentId: "pending-1",
      payload: { text: "hola", targetLang: "English", _locator: null },
      queuedAt: "2026-04-12T11:00:00.000Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    const bucket = getAiCommentsBucket(LIBRARY_ID, API);
    await bucket.hydratedPromise;
    expect(bucket.state.snapshot.map((row) => row.id)).toEqual(["from-disk"]);
    expect(bucket.state.pending.map((m) => m.id)).toEqual(["pending-1"]);
  });
});
