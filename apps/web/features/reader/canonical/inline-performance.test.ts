import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalBlock } from "./blocks";
import { canonicalInlines } from "./inlines";
import { inlineBook, inlineText } from "./inline-performance-fixture";

const parent = {
  id: "parent",
  family: "serif" as const,
  bold: false,
  italic: false,
  small_caps: false,
  color: "#123456",
};
const child = {
  ...parent,
  id: "child",
  relative_size: 1,
  vertical_align: "baseline" as const,
};
function projected(book: ReturnType<typeof inlineBook>) {
  const block = canonicalBlock(book, "body-one", {});
  if (!("inlines" in block)) throw new Error("Missing inlines");
  return block.inlines;
}

describe("canonical inline view compaction", () => {
  it("coalesces inherited word and whitespace runs without changing the canonical input", () => {
    const content = inlineText("😀e\u0301 words", [
      { id: "one", start: 0, end: 3, style_id: "child" },
      { id: "two", start: 4, end: 9, style_id: "child" },
    ]);
    content.normalization = {
      source_text: "😀e\u0301 words",
      source_sha256: "1".repeat(64),
      segments: [],
    };
    const book = inlineBook(content, parent, [child]);
    const digest = () =>
      createHash("sha256").update(JSON.stringify(book)).digest("hex");
    const before = digest();
    expect(projected(book)).toEqual([
      {
        kind: "text",
        text: content.text,
        presentation: { id: "child" },
        language: "uk",
        sourceOffset: 0,
        spanId: undefined,
      },
    ]);
    expect(digest()).toBe(before);
    expect(book.blocks.find((block) => block.id === "body-one")).toHaveProperty(
      "content",
      content,
    );
  });

  it("retains explicit false, zero and different colors over a styled parent", () => {
    const reset = {
      id: "reset-child",
      bold: false,
      italic: false,
      relative_size: 0,
      color: "#abcdef",
      indent_em: 0,
      line_height: 0,
    };
    const book = inlineBook(
      inlineText("reset", [
        { id: "reset", start: 0, end: 5, style_id: reset.id },
      ]),
      { ...parent, bold: true, italic: true },
      [reset],
    );
    expect(projected(book)[0].presentation).toMatchObject(reset);
  });

  it("does not equate undeclared heading or quote defaults with false", () => {
    for (const kind of ["heading", "quote"] as const) {
      const book = inlineBook(
        inlineText("plain", [
          { id: "reset", start: 0, end: 5, style_id: child.id },
        ]),
        undefined,
        [child],
      );
      const block = book.blocks.find((block) => block.id === "body-one")!;
      Object.assign(block, { kind, level: 2 });
      const result = projected(book)[0].presentation;
      expect(result?.bold).toBe(false);
      expect(result?.italic).toBe(false);
      expect(result?.color).toBe("#123456");
    }
  });

  it("keeps decorations, backgrounds, layout declarations and script sizing", () => {
    const decorated = {
      ...child,
      id: "decorated",
      underline: false,
      strike_through: false,
      decoration_color: "#123456",
      background_color: "#123456",
      align: "left" as const,
      indent_em: 0,
      block_indent_em: 0,
      space_before_em: 0,
      space_after_em: 0,
    };
    const script = { ...child, id: "script", vertical_align: "super" as const };
    const book = inlineBook(
      inlineText("ab", [
        { id: "a", start: 0, end: 1, style_id: decorated.id },
        { id: "b", start: 1, end: 2, style_id: script.id },
      ]),
      parent,
      [decorated, script],
    );
    expect(projected(book)).toHaveLength(2);
    expect(projected(book)[0].presentation).toMatchObject({
      underline: false,
      strike_through: false,
      decoration_color: "#123456",
      background_color: "#123456",
      align: "left",
      indent_em: 0,
      block_indent_em: 0,
      space_before_em: 0,
      space_after_em: 0,
    });
    expect(projected(book)[1].presentation).toMatchObject({
      relative_size: 1,
      vertical_align: "super",
    });
  });

  it.each([1, -1])(
    "retains repeated horizontal margin %s on equivalent adjacent view runs",
    (value) => {
      const margin = { id: "margin", block_indent_em: value };
      const book = inlineBook(
        inlineText("ab", [
          { id: "a", start: 0, end: 1, style_id: margin.id },
          { id: "b", start: 1, end: 2, style_id: margin.id },
        ]),
        parent,
        [margin],
      );
      expect(projected(book)).toHaveLength(2);
      expect(
        projected(book).map((run) => run.presentation?.block_indent_em),
      ).toEqual([value, value]);
    },
  );

  it("retains a styled outer span beneath an unstyled linked caller", () => {
    const content = inlineText("abcdef", [
      { id: "wide", start: 0, end: 6, style_id: "outer-style" },
      { id: "narrow", start: 0, end: 4, style_id: "inner-style" },
      {
        id: "caller",
        start: 1,
        end: 3,
        link: { kind: "external", url: "https://example.com/" },
      },
    ]);
    const book = inlineBook(content, undefined, [
      { id: "outer-style", bold: true },
      { id: "inner-style", bold: false },
    ]);
    const result = canonicalInlines(book, content);
    expect(result.map((inline) => inline.presentation)).toEqual([
      { id: "inner-style", bold: false },
      { id: "inner-style", bold: false },
      { id: "inner-style", bold: false },
      { id: "outer-style", bold: true },
    ]);
    expect(result[1]).toMatchObject({
      text: "bc",
      href: "https://example.com/",
      spanId: "caller",
      sourceOffset: 1,
    });
  });

  it("preserves legacy cascade priority including stable ties and null resets", () => {
    const book = inlineBook(
      inlineText("abcdef", [
        { id: "outer", start: 0, end: 6, style_id: "wide" },
        { id: "same-first", start: 1, end: 5, style_id: "first" },
        { id: "same-last", start: 1, end: 5, style_id: "last" },
        { id: "late", start: 2, end: 4, style_id: "late" },
      ]),
      undefined,
      [
        { id: "wide", bold: true, italic: true, relative_size: 2 },
        { id: "first", bold: false, italic: null },
        { id: "last", color: "#abcdef", relative_size: 0 },
        { id: "late", color: null, italic: false },
      ],
    );
    const result = canonicalInlines(
      book,
      (
        book.blocks.find((block) => block.id === "body-one") as {
          content: ReturnType<typeof inlineText>;
        }
      ).content,
    );
    expect(
      result.map((inline) => inline.kind === "text" && inline.text),
    ).toEqual(["a", "b", "cd", "e", "f"]);
    expect(result.map((inline) => inline.presentation)).toEqual([
      { id: "wide", bold: true, italic: true, relative_size: 2 },
      {
        id: "last",
        bold: false,
        italic: true,
        relative_size: 0,
        color: "#abcdef",
      },
      {
        id: "late",
        bold: false,
        italic: false,
        relative_size: 0,
        color: "#abcdef",
      },
      {
        id: "last",
        bold: false,
        italic: true,
        relative_size: 0,
        color: "#abcdef",
      },
      { id: "wide", bold: true, italic: true, relative_size: 2 },
    ]);
  });
});
