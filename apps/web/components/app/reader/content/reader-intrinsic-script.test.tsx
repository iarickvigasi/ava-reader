import { renderToStaticMarkup } from "react-dom/server";
import { ReaderInlineContent } from "./reader-inline-content";
import { describe, expect, it } from "vitest";
import { descendants, linkedText, nodeText, renderInlines } from "./reader-link-occurrence-fixture";

describe("intrinsic script rendering", () => {
  it.each([false, true])("keeps one link and exact text in measurement=%s", measurement => {
    const inlines = [linkedText({ text: "A😀¹2₂ⁱ³", script: "super", presentation: {
      id: "super", vertical_align: "super", relative_size: 0.7, bold: true, color: "#aa0000", underline: true,
    } })];
    const before = JSON.stringify(inlines);
    const result = renderInlines(inlines, measurement);
    expect(result.text).toBe("A😀¹2₂ⁱ³");
    expect(result.anchors).toHaveLength(1);
    const scripts = descendants(result.anchors[0]).filter(n => n.tagName === "sup");
    expect(scripts.map(nodeText)).toEqual(["A😀", "2₂ⁱ"]);
    expect(result.html).toContain("font-size:0.7em");
    expect(result.html).toContain("font-weight:700");
    expect(result.html).toContain("color:#aa0000");
    expect(result.html).not.toContain("vertical-align:super");
    expect(JSON.stringify(inlines)).toBe(before);
  });
  it("guards a combining mark after a link covering literal label and body", () => {
    const inlines = [linkedText({ text: "1. ¹", script: "super" }), { kind: "text" as const, text: "\u0301 tail" }];
    const html = renderToStaticMarkup(<ReaderInlineContent inlines={inlines} literalLabel={{end: 3, columnEm: 2}} />);
    expect(html).toMatch(/<sup[^>]*><span[^>]*>¹<\/span><\/sup>/);
    expect(html.match(/<a /g)).toHaveLength(1);
  });
  it("honors explicit script precedence over presentation", () => {
    const result = renderInlines([linkedText({ text: "¹₂", script: "sub", presentation: { id: "other", vertical_align: "super" } })]);
    expect(descendants(result.anchors[0]).filter(n => n.tagName === "sub").map(nodeText)).toEqual(["¹"]);
    expect(result.text).toBe("¹₂");
  });
  it("retains complex sequences split by existing style boundaries", () => {
    const result = renderInlines([linkedText({ text: "¹", script: "super" }), linkedText({ text: "\u0301" })]);
    expect(descendants(result.anchors[0]).filter(n => n.tagName === "sup").map(nodeText)).toEqual(["¹"]);
    expect(result.text).toBe("¹\u0301");
  });
});
