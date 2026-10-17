import { describe, expect, it } from "vitest";
import type { TextValue } from "@/lib/api-types/canonical-reader.generated";
import { canonicalInlines } from "@/features/reader/canonical/inlines";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";
import { nodeText, renderInlines } from "./reader-link-occurrence-fixture";

describe("canonical Unicode link boundaries", () => {
  it("preserves codepoint-to-UTF16 caller and target offsets across styled link runs", () => {
    const text = "😀e\u0301 See page e\u0301😀1.";
    const codepointUtf16: TextValue["codepoint_utf16"] = [0];
    for (const point of text) {
      codepointUtf16.push(codepointUtf16.at(-1)! + point.length);
    }
    const book = canonicalFixture().readerPackage!.book;
    const inlines = canonicalInlines(book, {
      text,
      sha256:
        "3ac6803d876d6fafac2cee3b586fb7f56d476d72e340af0f64d11674fd42d021",
      language: "uk",
      codepoint_utf16: codepointUtf16,
      spans: [
        { id: "page-style", start: 8, end: 12, style_id: "emphasis-bold" },
        {
          id: "unicode-style",
          start: 13,
          end: 16,
          style_id: "emphasis-italic",
        },
        {
          id: "unicode-reference",
          start: 8,
          end: 17,
          link: {
            kind: "internal",
            chapter_id: "chapter-one",
            block_id: "body-one",
            offset: 2,
          },
        },
      ],
    });
    const fragments = inlines.filter(
      (inline) => inline.kind === "text" && inline.target,
    );
    expect(
      fragments.map((inline) => inline.kind === "text" && inline.text),
    ).toEqual(["page", " ", "e\u0301😀", "1"]);
    for (const fragment of fragments) {
      expect(fragment.sourceOffset).toBe(9);
      expect(fragment.target?.textOffset).toBe(3);
    }
    const original = JSON.stringify(inlines);
    const rendered = renderInlines(inlines);
    expect(rendered.text).toBe(text);
    expect(rendered.anchors.map(nodeText)).toEqual(["page e\u0301😀1"]);
    expect(rendered.anchors[0].attrs).toContainEqual({
      name: "href",
      value: "#reader-chapter-one-body-one",
    });
    const group = groupInlineLinkOccurrences(inlines).find(
      (candidate) =>
        candidate.kind === "text" &&
        candidate.inlines[0].spanId === "unicode-reference",
    );
    expect(group?.kind === "text" && group.inlines[0].sourceOffset).toBe(9);
    expect(JSON.stringify(inlines)).toBe(original);
  });
});
