import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as highlights from "@/features/offline/buckets/highlights";
import * as comments from "@/features/offline/buckets/ai-comments";
import { ANNOTATION_SOURCES } from "./annotation-sources";

afterEach(() => vi.unstubAllGlobals());

describe("annotation refresh and active sync", () => {
  it.each([
    { kind: "highlights" as const, store: highlights, bucket: highlights.getHighlightsBucket },
    { kind: "comments" as const, store: comments, bucket: comments.getAiCommentsBucket },
  ])("waits for an already-running $kind deletion", async ({ kind, store, bucket: getBucket }) => {
    vi.stubGlobal("navigator", { onLine: true });
    const id = `busy-${kind}`;
    const api = "https://api.test";
    const bucket = getBucket(id, api);
    await bucket.hydratedPromise;
    if (kind === "highlights") {
      highlights.applyServerSnapshot(id, api, [{
        id: "saved-passage", excerpt: "Saved", color: "jade", locator: null,
        createdAt: "2026-09-11", updatedAt: "2026-09-11",
      }]);
    } else {
      comments.applyServerSnapshot(id, api, [{
        id: "saved-passage", sourceText: "Saved", body: "Explanation", kind: "EXPLAIN",
        locator: null, targetLang: null, createdAt: "2026-09-11",
      }]);
    }
    let finishDelete!: (response: Response) => void;
    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    const response = new Promise<Response>((resolve) => { finishDelete = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => {
      notifyStarted();
      return response;
    }));
    store.enqueueDelete(id, api, "saved-passage");
    store.setBucketAuth(id, api, async () => "token");
    const activeSync = store.flushBucket(id, api);
    await started;

    // flushBucket itself is intentionally non-blocking for a busy bucket.
    // The read adapter must join the actual work instead of that early return.
    const refreshBarrier = ANNOTATION_SOURCES[kind].flush(id, api);
    expect(refreshBarrier).toBe(activeSync);
    finishDelete(new Response(null, { status: 204 }));
    await refreshBarrier;
    expect(bucket.state.pending).toHaveLength(0);
  });
});
