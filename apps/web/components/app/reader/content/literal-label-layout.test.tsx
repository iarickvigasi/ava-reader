import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { ReaderInline } from "@/lib/api-types/reader-content";
import { ReaderInlineContent } from "./reader-inline-content";
import { listBodyStyle } from "./list-body-style";
import {
  markupNodes,
  markupText,
  attribute,
} from "../bilingual/content/flow-test-fixture";

it.each([false, true])(
  "preserves exact styled Unicode text with one covering link=%s",
  (linked) => {
    const link = linked
      ? { href: "https://example.com/column", spanId: "one", sourceOffset: 0 }
      : {};
    const inlines: ReaderInline[] = [
      { kind: "text", text: "First ", bold: true, ...link },
      { kind: "text", text: "A😀B café", italic: true, ...link },
    ];
    const before = JSON.stringify(inlines);
    const html = renderToStaticMarkup(
      <ReaderInlineContent
        inlines={inlines}
        literalLabel={{ end: 6, columnEm: 4.2 }}
      />,
    );
    expect(markupText(markupNodes(`<div>${html}</div>`, "div")[0])).toBe(
      "First A😀B café",
    );
    expect(markupNodes(html, "a")).toHaveLength(linked ? 1 : 0);
    const label = markupNodes(html, "span").find(
      (n) => attribute(n, "data-reader-literal-label") !== undefined,
    )!;
    expect(markupText(label)).toBe("First ");
    expect(attribute(label, "style")).toContain("width:4.2em");
    expect(JSON.stringify(inlines)).toBe(before);
  },
);

it("continues body indentation without repeating the label and leaves translation unaligned", () => {
  const item = {
    id: "item",
    text: "First body",
    literalLabel: { end: 6, columnEm: 4.2 },
  };
  expect(listBodyStyle(item).body).toMatchObject({
    paddingInlineStart: "4.2em",
    textIndent: "-4.2em",
  });
  expect(listBodyStyle(item, { continued: true }).body).toMatchObject({
    paddingInlineStart: "4.2em",
    textIndent: "0em",
  });
  expect(listBodyStyle(item, { translation: true }).body).toMatchObject({
    paddingInlineStart: "0em",
    textIndent: "0em",
  });
});
