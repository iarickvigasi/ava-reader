import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The store reaches for `window.localStorage` and `navigator.onLine`; the
// repo's vitest config doesn't include jsdom, so stub a minimal browser-like
// global. Tests then run under plain node and exercise the same code paths a
// real browser would.
beforeAll(() => {
  const store = new Map<string, string>();
  const localStorageStub: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal("window", {
    localStorage: localStorageStub,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("navigator", { onLine: true });
});
import {
  applyServerSnapshot,
  enqueueDelete,
  enqueueUpsert,
  flushBucket,
  getHighlightsBucket,
  selectStableHighlights,
  setBucketAuth,
  type HighlightRecord,
} from "./highlights-store";

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

function freshBucketKey(): string {
  // Each test gets a unique library id so the module-level Map and
  // localStorage don't leak across tests.
  return `${LIBRARY_ID}:${Math.random().toString(36).slice(2)}`;
}

describe("highlights store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies pending upsert on top of empty snapshot", () => {
    const id = freshBucketKey();
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hello",
      color: "apricot",
      locator: sampleLocator,
    });
    const records = selectStableHighlights(getHighlightsBucket(id, API));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "h-1",
      excerpt: "hello",
      color: "apricot",
    });
  });

  it("coalesces successive upserts on the same id into a single pending mutation", () => {
    const id = freshBucketKey();
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: null,
    });
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "jade",
      locator: null,
    });
    const bucket = getHighlightsBucket(id, API);
    expect(bucket.state.pending).toHaveLength(1);
    const records = selectStableHighlights(bucket);
    expect(records[0]?.color).toBe("jade");
  });

  it("treats delete-of-never-synced as a no-op (drops the local upsert)", () => {
    const id = freshBucketKey();
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: null,
    });
    enqueueDelete(id, API, "h-1");
    const bucket = getHighlightsBucket(id, API);
    expect(bucket.state.pending).toHaveLength(0);
    expect(selectStableHighlights(bucket)).toHaveLength(0);
  });

  it("queues a delete when the row is part of the server snapshot", () => {
    const id = freshBucketKey();
    const row: HighlightRecord = {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    applyServerSnapshot(id, API, [row]);
    enqueueDelete(id, API, "h-1");
    const bucket = getHighlightsBucket(id, API);
    expect(bucket.state.pending).toHaveLength(1);
    expect(bucket.state.pending[0].kind).toBe("delete");
    // The merged view hides the row even before the flush completes.
    expect(selectStableHighlights(bucket)).toHaveLength(0);
  });

  it("returns referentially-stable arrays between unrelated calls", () => {
    const id = freshBucketKey();
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: null,
    });
    const a = selectStableHighlights(getHighlightsBucket(id, API));
    const b = selectStableHighlights(getHighlightsBucket(id, API));
    expect(a).toBe(b);
  });

  it("hydrates from localStorage on first access", () => {
    const id = freshBucketKey();
    const initial = {
      version: 1,
      snapshot: [],
      pending: [
        {
          kind: "upsert" as const,
          id: "h-1",
          payload: {
            excerpt: "from storage",
            highlightColor: "sky" as const,
            locator: null,
          },
          queuedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    window.localStorage.setItem(
      `ava-reader:highlights:${id}`,
      JSON.stringify(initial),
    );
    const records = selectStableHighlights(getHighlightsBucket(id, API));
    expect(records[0]?.excerpt).toBe("from storage");
  });

  it("flushes a pending upsert with PUT and clears the queue on 200", async () => {
    const id = freshBucketKey();
    // Enqueue *before* auth is set so the auto-flush kicked off by
    // enqueueUpsert is a no-op (no token available). Then set auth and
    // explicitly drive the flush so we own its lifetime.
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: sampleLocator,
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            id: "h-1",
            excerpt: "hi",
            highlightColor: "apricot",
            locator: sampleLocator,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    setBucketAuth(id, API, async () => "test-token");
    await flushBucket(id, API);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `${API}/api/library/${encodeURIComponent(id)}/annotations/h-1`,
    );
    expect((init as RequestInit).method).toBe("PUT");
    const bucket = getHighlightsBucket(id, API);
    expect(bucket.state.pending).toHaveLength(0);
    expect(bucket.state.snapshot).toHaveLength(1);
  });

  it("retries on 5xx by leaving the head of the queue in place", async () => {
    const id = freshBucketKey();
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: null,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("oops", { status: 503 }),
    );
    setBucketAuth(id, API, async () => "test-token");
    await flushBucket(id, API);
    const bucket = getHighlightsBucket(id, API);
    expect(bucket.state.pending).toHaveLength(1);
  });

  it("drops the mutation on 4xx (other than auth) so the queue does not deadlock", async () => {
    const id = freshBucketKey();
    enqueueUpsert(id, API, {
      id: "h-1",
      excerpt: "hi",
      color: "apricot",
      locator: null,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 400 }),
    );
    setBucketAuth(id, API, async () => "test-token");
    await flushBucket(id, API);
    const bucket = getHighlightsBucket(id, API);
    expect(bucket.state.pending).toHaveLength(0);
  });
});
