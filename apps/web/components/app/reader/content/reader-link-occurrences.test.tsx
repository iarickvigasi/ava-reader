import { describe, expect, it } from "vitest";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";
import {
  descendants,
  linkedText,
  nodeText,
  pageReferenceInlines,
  renderInlines,
} from "./reader-link-occurrence-fixture";

describe("reader semantic link occurrences", () => {
  it("renders one styled page reference as one named anchor, including its space", () => {
    const inlines = pageReferenceInlines();
    const original = JSON.stringify(inlines);
    const { anchors, html, text } = renderInlines(inlines);
    expect(text).toBe("See page 1 for the table.");
    expect(anchors.map(nodeText)).toEqual(["page 1"]);
    expect(anchors[0].attrs).toContainEqual({
      name: "href",
      value: "#reader-chapter-two-note-one",
    });
    expect(html).toContain("font-weight:700");
    expect(html).toContain("font-style:italic");
    expect(
      descendants(anchors[0]).filter((node) => node.tagName === "a"),
    ).toHaveLength(1);
    expect(JSON.stringify(inlines)).toBe(original);
  });

  it("keeps the same grouped text and styles in noninteractive measurement", () => {
    const { anchors, html, text } = renderInlines(pageReferenceInlines(), true);
    expect(text).toBe("See page 1 for the table.");
    expect(anchors.map(nodeText)).toEqual(["page 1"]);
    expect(anchors[0].attrs.some((attr) => attr.name === "href")).toBe(false);
    expect(html).not.toContain("tabindex=");
    expect(html).not.toContain("onclick=");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("font-style:italic");
  });

  it("preserves Unicode, language, script and source metadata within one external occurrence", () => {
    const text = "Їe\u0301😀";
    const shared = {
      target: undefined,
      href: "https://example.org/reference",
      language: "uk",
    };
    const inlines = [
      linkedText({
        ...shared,
        text,
        italic: true,
        anchorIds: ["caller-anchor"],
        sourceNormalization: {
          sourceText: text,
          boundaryUtf16: Array.from({ length: text.length + 1 }, (_, i) => i),
        },
      }),
      linkedText({
        ...shared,
        text: "2",
        script: "super",
        presentation: {
          id: "super",
          vertical_align: "super",
          relative_size: 0.7,
        },
      }),
    ];
    const original = JSON.stringify(inlines);
    const rendered = renderInlines(inlines);
    expect(rendered.text).toBe(`${text}2`);
    expect(rendered.anchors.map(nodeText)).toEqual([`${text}2`]);
    expect(rendered.html).toContain('lang="uk"');
    expect(rendered.html).toContain('<sup style="font-size:inherit">');
    expect(rendered.html).toContain("font-size:0.7em");
    expect(rendered.html).not.toContain("vertical-align:super");
    const group = groupInlineLinkOccurrences(inlines)[0];
    expect(group.kind).toBe("text");
    if (group.kind !== "text") throw new Error("Missing text occurrence");
    group.inlines.forEach((inline, index) =>
      expect(inline).toBe(inlines[index]),
    );
    expect(JSON.stringify(inlines)).toBe(original);
  });
});
