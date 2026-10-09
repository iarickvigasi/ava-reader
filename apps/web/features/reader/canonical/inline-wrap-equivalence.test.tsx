import { expect, it } from "vitest";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { inlineBook, inlineText } from "./inline-performance-fixture";
import { canonicalBlock } from "./blocks";
import { canonicalInlines } from "./inlines";
import { renderInlines } from "@/components/app/reader/content/reader-link-occurrence-fixture";

it.each([
  "https://example.com/path",
  "alpha-beta-gamma-delta",
  "1234567890abcde-fghij",
])(
  "preserves original wrapping opportunities across equivalent seams in %s",
  (text) => {
    const style = { id: "plain", bold: false };
    const content = inlineText(text, [
      { id: "one", start: 0, end: 10, style_id: style.id },
      { id: "two", start: 10, end: text.length, style_id: style.id },
    ]);
    const book = inlineBook(content, { ...style, id: "parent" }, [style]);
    const legacy = canonicalInlines(book, content);
    const block = canonicalBlock(book, "body-one", {});
    if (!("inlines" in block)) throw new Error("Missing text fixture");
    const actual = renderInlines(block.inlines);
    expect(actual.text).toBe(text);
    expect(breakOffsets(actual.html)).toEqual(
      breakOffsets(renderInlines(legacy).html),
    );
    expect(
      block.inlines.map((inline) => inline.kind === "text" && inline.text),
    ).toEqual(legacy.map((inline) => inline.kind === "text" && inline.text));
    expect(block.inlines.map((inline) => inline.sourceOffset)).toEqual([0, 10]);
  },
);

it.each(["abcdefghijklmnopqrstuvwx", "longhttps://name.example/path"])(
  "still merges %s when joining preserves all wrap opportunities",
  (text) => {
    const style = { id: "plain", bold: false };
    const content = inlineText(text, [
      { id: "one", start: 0, end: 10, style_id: style.id },
      { id: "two", start: 10, end: text.length, style_id: style.id },
    ]);
    const book = inlineBook(content, { ...style, id: "parent" }, [style]);
    const block = canonicalBlock(book, "body-one", {});
    if (!("inlines" in block)) throw new Error("Missing text fixture");
    expect(block.inlines).toHaveLength(1);
    expect(renderInlines(block.inlines).text).toBe(content.text);
    expect(breakOffsets(renderInlines(block.inlines).html)).toEqual(
      breakOffsets(renderInlines(canonicalInlines(book, content)).html),
    );
  },
);

it("preserves UTF16 fallback offsets with supplementary and combining characters", () => {
  const text = "😀e\u0301abcdefghij-klmnopqr";
  const content = inlineText(text);
  content.spans = [
    { id: "one", start: 0, end: 10, style_id: "plain" },
    {
      id: "two",
      start: 10,
      end: content.codepoint_utf16.length - 1,
      style_id: "plain",
    },
  ];
  const book = inlineBook(content, { id: "parent", bold: false }, [
    { id: "plain", bold: false },
  ]);
  const legacy = canonicalInlines(book, content);
  const block = canonicalBlock(book, "body-one", {});
  if (!("inlines" in block)) throw new Error("Missing text fixture");
  expect(renderInlines(block.inlines).text).toBe(text);
  expect(breakOffsets(renderInlines([{ kind: "text", text }]).html)).toEqual([
    15,
  ]);
  expect(breakOffsets(renderInlines(legacy).html)).toEqual([]);
  expect(block.inlines.map((inline) => inline.sourceOffset)).toEqual([0, 11]);
  expect(breakOffsets(renderInlines(block.inlines).html)).toEqual(
    breakOffsets(renderInlines(legacy).html),
  );
});

function breakOffsets(html: string) {
  let offset = 0;
  const result: number[] = [];
  const visit = (node: DefaultTreeAdapterMap["node"]) => {
    if ("value" in node) offset += node.value.length;
    if ("tagName" in node && node.tagName === "wbr") result.push(offset);
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parseFragment(html));
  return result;
}
