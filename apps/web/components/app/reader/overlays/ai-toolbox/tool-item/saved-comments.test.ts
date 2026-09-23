import { describe, expect, it } from "vitest";
import type { ReaderRangeLocator } from "@/lib/api-types";
import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import { selectSavedComments } from "./saved-comments";

const source: ReaderRangeLocator = { chapterId: "c", startBlockId: "p", endBlockId: "p", startOffset: 0, endOffset: 5, contextBefore: "", contextAfter: "" };
const translated: ReaderRangeLocator = { ...source, translation: { targetLang: "French", contentRevision: "r", startSentenceId: "s", endSentenceId: "s", startOffset: 0, endOffset: 7 } };
const comment = (locator: ReaderRangeLocator, body: string): AiCommentRecord => ({ id: body, kind: "EXPLAIN", sourceText: "word", body, locator, targetLang: null, status: "ready", error: null, createdAt: "2026-09-23" });

describe("saved bilingual comments", () => {
  it("reopens only comments belonging to the selected language and offsets", () => {
    const comments = [comment(source, "original"), comment(translated, "translated")];
    expect(selectSavedComments(comments, source).explain?.body).toBe("original");
    expect(selectSavedComments(comments, translated).explain?.body).toBe("translated");
    expect(selectSavedComments(comments, { ...translated, translation: { ...translated.translation!, targetLang: "Spanish" } })).toEqual({});
    expect(selectSavedComments(comments, { ...source, chapterId: "other" })).toEqual({});
  });
  it("does not reuse a translation in the wrong target language", () => {
    const saved: AiCommentRecord = { ...comment(source, "bonjour"), kind: "TRANSLATE", targetLang: "French" };
    expect(selectSavedComments([saved], source, "French").translate?.body).toBe("bonjour");
    expect(selectSavedComments([saved], source, "Spanish").translate).toBeUndefined();
  });
});
