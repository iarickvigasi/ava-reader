import { expect, it } from "vitest";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import type { ReadyReaderPayload } from "./types";
import { formatReaderHeaderParts } from "./format-reader-header-parts";

it("uses the readable TOC name when a cached chapter label is its internal ID", () => {
  const payload = createReaderResumeFixturePayload() as ReadyReaderPayload;
  const chapter = {
    ...payload.chapters[0],
    label: "chapter-1",
    title: "chapter-1",
  };
  expect(formatReaderHeaderParts(payload, chapter)).toEqual({
    title: payload.book.title,
    author: "Fixture Author",
    chapter: "Fixture Chapter 01",
  });
});

it.each([
  ["7. Men learn to love…", "Ignored title", "7. Men learn to love…"],
  ["chapter-7-part0007", "Understanding Men", "Understanding Men"],
  ["part0007.xhtml", "chapter-7-part0007", "7."],
  ["  ", "  ", "7."],
])(
  "resolves label %s without leaking internal IDs",
  (label, title, expected) => {
    const payload = createReaderResumeFixturePayload() as ReadyReaderPayload;
    payload.toc = [];
    const chapter = {
      ...payload.chapters[0],
      chapterId: "chapter-7-part0007",
      href: "text/part0007.xhtml",
      spineIndex: 6,
      label,
      title,
    };
    expect(formatReaderHeaderParts(payload, chapter).chapter).toBe(expected);
  },
);
