import { describe, expect, it } from "vitest";
import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import type { CommentListLabels } from "./types";
import { formatCommentList } from "./format-comment-list";

const labels: CommentListLabels = {
  kinds: { EXPLAIN: "Објашњење", TRANSLATE: "Превод", ETYMOLOGY: "Етимологија" },
  statuses: { queued: "Waiting", generating: "Generating", failed: "Failed", empty: "Empty response" },
};
const comment: AiCommentRecord = {
  id: "comment", sourceText: "Извор 🌿\n\nSecond paragraph.", body: "Answer.\n\nFull explanation.",
  kind: "EXPLAIN", targetLang: null, createdAt: "2026-09-12", status: "ready", error: null,
  locator: {
    chapterId: "chapter", startBlockId: "a", startOffset: 0, endBlockId: "b", endOffset: 3,
    contextBefore: "", contextAfter: "",
  },
};

describe("formatCommentList", () => {
  it("includes localized kind, cached chapter, full source and response paragraphs", () => {
    const text = formatCommentList([comment], new Map([["chapter", "Глава 1"]]), labels);
    expect(text).toBe("Објашњење · Глава 1\n\nИзвор 🌿\n\nSecond paragraph.\n\nAnswer.\n\nFull explanation.");
  });

  it("copies every comment and full response in input order without a cap", () => {
    const comments = Array.from({ length: 31 }, (_, index) => ({
      ...comment, id: `c${index}`, sourceText: `Source [${30 - index}]`,
      body: `Response [${30 - index}] ${"Long answer.\n".repeat(100)}`, locator: null,
    }));
    const entries = formatCommentList(comments, new Map(), labels).split("\n\n---\n\n");
    expect(entries).toHaveLength(31);
    for (const [index, entry] of entries.entries()) {
      expect(entry).toContain(comments[index].sourceText);
      expect(entry).toContain(comments[index].body);
    }
    expect(comments[0].id).toBe("c0");
  });

  it.each([
    { status: "queued", body: "", error: null, displayed: "Waiting" },
    { status: "queued", body: "Saved partial", error: null, displayed: "Waiting" },
    { status: "streaming", body: "", error: null, displayed: "Generating" },
    { status: "streaming", body: "Partial answer", error: null, displayed: "Generating" },
    { status: "failed", body: "", error: "No credits left", displayed: "No credits left" },
    { status: "failed", body: "Partial answer", error: "Custom error", displayed: "Custom error" },
    { status: "failed", body: "Partial answer", error: null, displayed: "Failed" },
    { status: "ready", body: "", error: null, displayed: "Empty response" },
  ] as const)("includes displayed $status status alongside available body: $body", (entry) => {
    const text = formatCommentList([{ ...comment, ...entry, locator: null }], new Map(), labels);
    const content = ["Објашњење", comment.sourceText, entry.body, entry.displayed].filter(Boolean);
    expect(text).toBe(content.join("\n\n"));
  });

  it.each(["TRANSLATE", "EXPLAIN", "ETYMOLOGY"] as const)("localizes %s without absent chapter metadata", (kind) => {
    const body = "  Answer.\n\nUntrimmed end.\n";
    expect(formatCommentList([{ ...comment, kind, body }], new Map(), labels))
      .toBe(`${labels.kinds[kind]}\n\n${comment.sourceText}\n\n${body}`);
  });

  it("returns no text for an empty list", () => {
    expect(formatCommentList([], new Map(), labels)).toBe("");
  });
});
