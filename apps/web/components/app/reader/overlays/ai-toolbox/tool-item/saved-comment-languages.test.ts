import { expect, it } from "vitest";
import { selectSavedComments } from "./saved-comments";
import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import type { ReaderRangeLocator } from "@/lib/api-types";
const locator = {
  chapterId: "c",
  startBlockId: "b",
  endBlockId: "b",
  startOffset: 0,
  endOffset: 4,
  contextBefore: "",
  contextAfter: "",
} satisfies ReaderRangeLocator;
const row = (
  kind: AiCommentRecord["kind"],
  targetLang: string,
  status: AiCommentRecord["status"],
  body: string,
): AiCommentRecord => ({
  id: body,
  kind,
  targetLang,
  status,
  body,
  error: null,
  sourceText: "word",
  locator,
  createdAt: "2026-10-31T00:00:00Z",
});
it.each(["EXPLAIN", "ETYMOLOGY", "TRANSLATE"] as const)(
  "isolates %s queued/streaming/ready results by language",
  (kind) => {
    const english = row(kind, "English", "streaming", "old English");
    for (const status of ["queued", "streaming", "ready", "failed"] as const) {
      const uk = row(
        kind,
        "Ukrainian",
        status,
        status === "ready" ? "Українською" : "",
      );
      const selected = selectSavedComments([english, uk], locator, "Ukrainian");
      expect(Object.values(selected)).toEqual([
        { body: uk.body, status, error: null },
      ]);
    }
  },
);
it("supersedes a failed same-time attempt with the newly appended retry", () => {
  const failed = row("EXPLAIN", "English", "failed", "failed");
  const retry = row("EXPLAIN", "English", "queued", "");
  expect(
    selectSavedComments([failed, retry], locator, "English").explain?.status,
  ).toBe("queued");
  expect(
    selectSavedComments(
      [failed, { ...retry, status: "ready", body: "done" }],
      locator,
      "English",
    ).explain?.body,
  ).toBe("done");
});
