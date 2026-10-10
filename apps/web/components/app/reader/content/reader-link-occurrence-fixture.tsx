import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import type { ReaderInline } from "@/lib/api-types";
import { canonicalInlines } from "@/features/reader/canonical/inlines";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { ReaderInlineContent } from "./reader-inline-content";
import { ReaderMeasurementContext } from "./reader-measurement-context";

type Node = DefaultTreeAdapterMap["node"];
type TextInline = Extract<ReaderInline, { kind: "text" }>;

export function linkedText(overrides: Partial<TextInline> = {}): TextInline {
  return {
    kind: "text",
    text: "1",
    spanId: "caller-one",
    sourceOffset: 4,
    target: { chapterId: "chapter-two", blockId: "note-one", textOffset: 0 },
    ...overrides,
  };
}

// The observed source's one page-reference span crosses two word-style boundaries.
export function pageReferenceInlines() {
  const text = "See page 1 for the table.";
  const book = canonicalFixture().readerPackage!.book;
  return canonicalInlines(book, {
    text,
    sha256: "2e33bc7287bbffeef88eedb423d89f294807555914a55a52325e1d38d97fd560",
    codepoint_utf16: [
      0,
      ...Array.from({ length: text.length }, (_, i) => i + 1),
    ],
    spans: [
      { id: "p1-line13-span1", start: 4, end: 8, style_id: "emphasis-bold" },
      { id: "p1-line13-span2", start: 9, end: 10, style_id: "emphasis-italic" },
      {
        id: "p1-line13-source-reference0",
        start: 4,
        end: 10,
        link: {
          kind: "internal",
          chapter_id: "chapter-two",
          block_id: "note-one",
          offset: 0,
        },
      },
    ],
  });
}

export function renderInlines(inlines: ReaderInline[], measurement = false) {
  const html = renderToStaticMarkup(
    <ReaderMeasurementContext value={measurement}>
      <ReaderInlineContent inlines={inlines} />
    </ReaderMeasurementContext>,
  );
  const document = parseFragment(html);
  return {
    html,
    text: nodeText(document),
    anchors: descendants(document).filter((node) => node.tagName === "a"),
  };
}

export function descendants(node: Node): DefaultTreeAdapterMap["element"][] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(descendants) : []),
  ];
}

export function nodeText(node: Node): string {
  return "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(nodeText).join("")
      : "";
}
