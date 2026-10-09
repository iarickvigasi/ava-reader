import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReaderBlockView } from "@/components/app/reader/content/reader-block-view";
import {
  renderInlines,
  nodeText,
} from "@/components/app/reader/content/reader-link-occurrence-fixture";
import { resolveBlockStyle } from "@/components/app/reader/content/reader-block-style";
import { canonicalBlock } from "./blocks";
import { canonicalInlines } from "./inlines";
import { canonicalStyle } from "./style";
import { inlineBook, inlineText } from "./inline-performance-fixture";

const parent = {
  id: "explicit-parent",
  bold: false,
  italic: false,
  family: "serif" as const,
  small_caps: false,
  color: "#123456",
  relative_size: 2,
};
const child = {
  ...parent,
  id: "explicit-child",
  relative_size: 1,
  vertical_align: "baseline" as const,
};
function textBlock(book: ReturnType<typeof inlineBook>) {
  const block = canonicalBlock(book, "body-one", {});
  if (!("inlines" in block)) throw new Error("Missing inlines");
  return block;
}

describe("effective canonical renderer styles", () => {
  it.each(["heading", "quote"] as const)(
    "inherits explicit false overrides of %s defaults",
    (kind) => {
      const book = inlineBook(
        inlineText("a b", [
          { id: "a", start: 0, end: 1, style_id: child.id },
          { id: "b", start: 2, end: 3, style_id: child.id },
        ]),
        parent,
        [child],
      );
      Object.assign(book.blocks.find((block) => block.id === "body-one")!, {
        kind,
        level: 2,
      });
      const block = textBlock(book);
      expect(block.inlines).toHaveLength(1);
      expect(resolveBlockStyle(block)).toMatchObject({
        fontWeight: 400,
        fontStyle: "normal",
        fontFamily: "var(--font-reader), serif",
        color: "#123456",
      });
      expect(canonicalStyle(block.inlines[0].presentation)).toEqual({});
      const html = renderToStaticMarkup(
        <ReaderBlockView
          block={block}
          chapterId="chapter-one"
          pageHeight={600}
        />,
      );
      expect(html).toContain("font-weight:400");
      expect(html).toContain(kind === "heading" ? "font-bold" : "italic");
    },
  );

  it("retains font-family on ordinary code's preflight monospace wrapper", () => {
    const book = inlineBook(
      inlineText("code", [
        { id: "code", start: 0, end: 4, style_id: child.id },
      ]),
      parent,
      [child],
    );
    Object.assign(book.blocks.find((block) => block.id === "body-one")!, {
      kind: "code",
    });
    const block = textBlock(book);
    expect(block.inlines[0].presentation?.family).toBe("serif");
    const html = renderToStaticMarkup(
      <ReaderBlockView
        block={block}
        chapterId="chapter-one"
        pageHeight={600}
      />,
    );
    expect(html).toMatch(/<code>.*font-family:var\(--font-reader\), serif/);
  });

  it("keeps child size multiplication, explicit baseline resets and both script sizes", () => {
    const double = { ...child, id: "double", relative_size: 2 };
    const superStyle = {
      ...child,
      id: "super",
      vertical_align: "super" as const,
    };
    const subStyle = { ...child, id: "sub", vertical_align: "sub" as const };
    const book = inlineBook(
      inlineText("abcd", [
        { id: "a", start: 0, end: 1, style_id: double.id },
        { id: "b", start: 1, end: 2, style_id: superStyle.id },
        { id: "c", start: 2, end: 3, style_id: child.id },
        { id: "d", start: 3, end: 4, style_id: subStyle.id },
      ]),
      parent,
      [child, double, superStyle, subStyle],
    );
    const block = textBlock(book);
    expect(resolveBlockStyle(block)).toHaveProperty("--reader-block-scale", 2);
    expect(block.inlines.map((run) => run.presentation?.relative_size)).toEqual(
      [2, 1, undefined, 1],
    );
    expect(
      block.inlines.map((run) => run.presentation?.vertical_align),
    ).toEqual([undefined, "super", undefined, "sub"]);
    const { html, text } = renderInlines(block.inlines);
    expect(text).toBe("abcd");
    expect(html).toContain('<sup style="font-size:inherit">');
    expect(html).toContain('<sub style="font-size:inherit">');
    expect(html).toContain("font-size:2em");
  });

  it("retains all styled Unicode caller fragments and distinct same-destination links", () => {
    const content = inlineText("😀e\u0301 See page e\u0301😀1. page", [
      { id: "style-one", start: 8, end: 12, style_id: child.id },
      { id: "style-two", start: 13, end: 16, style_id: "emphasis-italic" },
      {
        id: "first-caller",
        start: 8,
        end: 17,
        link: {
          kind: "internal",
          chapter_id: "chapter-two",
          block_id: "note-one",
          offset: 0,
        },
      },
      {
        id: "second-caller",
        start: 19,
        end: 23,
        link: {
          kind: "internal",
          chapter_id: "chapter-two",
          block_id: "note-one",
          offset: 0,
        },
      },
    ]);
    const book = inlineBook(content, parent, [child]);
    const legacy = canonicalInlines(book, content);
    const actual = textBlock(book).inlines;
    const links = actual.filter((run) => run.kind === "text" && run.target);
    expect(links).toEqual(
      legacy.filter((run) => run.kind === "text" && run.target),
    );
    expect(links.map((run) => run.kind === "text" && run.text)).toEqual([
      "page",
      " ",
      "e\u0301😀",
      "1",
      "page",
    ]);
    expect(links.map((run) => run.sourceOffset)).toEqual([9, 9, 9, 9, 21]);
    const rendered = renderInlines(actual);
    expect(rendered.text).toBe(content.text);
    expect(rendered.anchors.map(nodeText)).toEqual(["page e\u0301😀1", "page"]);
    expect(links[0].presentation).toMatchObject(child);
  });

  it("keeps table cell identifiers, spans, header associations and header false resets", () => {
    const book = inlineBook(inlineText("unused"));
    const table = book.blocks.find((block) => block.kind === "table")!;
    if (table.kind !== "table") throw new Error("Missing table");
    const before = table.cells.map(
      ({
        id,
        row,
        column,
        row_span,
        column_span,
        header_axis,
        header_ids,
      }) => ({
        id,
        row,
        column,
        row_span,
        column_span,
        header_axis,
        header_ids,
      }),
    );
    const header = table.cells.find((cell) => cell.header_axis)!;
    header.style_id = undefined;
    header.content = inlineText("plain", [
      { id: "header-reset", start: 0, end: 5, style_id: child.id },
    ]);
    book.styles.push(child);
    const actual = canonicalBlock(book, table.id, {});
    if (actual.kind !== "table") throw new Error("Missing projected table");
    expect(
      actual.cells.map(
        ({ id, row, column, rowSpan, columnSpan, headerAxis, headerIds }) => ({
          id,
          row,
          column,
          row_span: rowSpan,
          column_span: columnSpan,
          header_axis: headerAxis,
          header_ids: headerIds,
        }),
      ),
    ).toEqual(
      before.map((cell) => ({
        ...cell,
        row_span: cell.row_span ?? 1,
        column_span: cell.column_span ?? 1,
        header_ids: cell.header_ids ?? [],
      })),
    );
    expect(
      actual.cells.find((cell) => cell.id === header.id)?.inlines[0]
        .presentation?.bold,
    ).toBe(false);
    expect(header.content.text).toBe("plain");
  });
});
