import { describe, expect, it } from "vitest";
import { findBookText, searchExcerpt } from "./find";
import { MAX_SEARCH_RESULTS, type SearchPassage } from "./types";
const passage = (text: string): SearchPassage => ({
  chapterId: "one",
  chapterLabel: "One",
  blockId: "body",
  textOffset: 0,
  text,
});
describe("whole-book literal search", () => {
  it("preserves exact UTF16 offsets across emoji and Ukrainian case", () => {
    const text = "😀 ЇЇ ґрунт і Єва. Її ҐРУНТ";
    const { hits } = findBookText([passage(text)], "ґрунт");
    expect(hits.map((hit) => hit.textOffset)).toEqual([6, 22]);
    expect(
      hits.map((hit) => text.slice(hit.textOffset, hit.endOffset)),
    ).toEqual(["ґрунт", "ҐРУНТ"]);
    expect(findBookText([passage(text)], "Грунт").hits).toHaveLength(0);
    expect(findBookText([passage("п’ять п'ять")], "п’ять").hits).toHaveLength(
      1,
    );
  });
  it("treats regex syntax literally and keeps distinct repeated occurrences", () => {
    expect(
      findBookText([passage("[a.*] [a.*]")], "[a.*]").hits.map(
        (hit) => hit.textOffset,
      ),
    ).toEqual([0, 6]);
    expect(
      findBookText(
        [passage("a word"), { ...passage("a word"), chapterId: "two" }],
        "word",
      ).hits.map((hit) => hit.chapterId),
    ).toEqual(["one", "two"]);
  });
  it("does not falsely report a complete result after the display bound", () => {
    const result = findBookText(
      [passage("word ".repeat(MAX_SEARCH_RESULTS + 1))],
      "word",
    );
    expect(result.hits).toHaveLength(MAX_SEARCH_RESULTS);
    expect(result.truncated).toBe(true);
    expect(
      findBookText([passage("word ".repeat(MAX_SEARCH_RESULTS))], "word")
        .truncated,
    ).toBe(false);
    expect(findBookText([passage("word")], "  ").hits).toHaveLength(0);
    expect(findBookText([passage("word")], "x".repeat(257)).hits).toHaveLength(
      0,
    );
  });
  it("keeps original matched text and surrogate-safe excerpt edges", () => {
    const text = "😀".repeat(60) + "Ґрунт" + "😀".repeat(80);
    const hit = findBookText([passage(text)], "ґрунт").hits[0];
    const excerpt = searchExcerpt(hit);
    expect(excerpt).toEqual({
      before: "…" + "😀".repeat(40),
      match: "Ґрунт",
      after: "😀".repeat(60) + "…",
    });
  });
});
