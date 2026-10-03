import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import oracle from "@/features/reader/canonical/fixtures/oracle.json";
import { ReaderBlockView } from "./reader-block-view";

type Node = DefaultTreeAdapterMap["node"];
function text(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join("") : "";
}
function descendants(node: Node): DefaultTreeAdapterMap["element"][] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(descendants) : []),
  ];
}
function html() {
  return canonicalFixture()
    .chapters.map((chapter) =>
      chapter.blocks
        .map((block) =>
          renderToStaticMarkup(
            <ReaderBlockView
              key={block.id}
              block={block}
              chapterId={chapter.chapterId}
              pageHeight={700}
            />,
          ),
        )
        .join(""),
    )
    .join("");
}
describe("canonical reader semantic DOM", () => {
  it("renders every independently authored text leaf verbatim", () => {
    const nodes = descendants(parseFragment(html()));
    for (const [id, expected] of Object.entries(oracle.text_by_id)) {
      const node = nodes.find((item) =>
        item.attrs.some(
          (attr) => attr.name === "data-block-id" && attr.value === id,
        ),
      );
      expect(node && text(node), id).toBe(expected);
    }
  });
  it("preserves nested ordered starts, table header graph and figure association", () => {
    const markup = html();
    expect(markup).toContain('start="3"');
    expect(markup).toMatch(/<li[^>]*>[\s\S]*list-parent[\s\S]*<ul/);
    expect(markup).toContain(
      'headers="reader-chapter-one-cell-01 reader-chapter-one-cell-10"',
    );
    expect(markup).toContain('scope="col"');
    expect(markup).toContain(
      'aria-describedby="reader-chapter-one-caption-one"',
    );
    expect(markup).toContain('alt="A blue window."');
  });
  it("exposes literal text, note links and false/zero CSS without changing text", () => {
    const markup = html();
    expect(markup).toContain("white");
    expect(markup).toContain("font-weight:400");
    expect(markup).toContain("font-style:normal");
    expect(markup).toContain("text-indent:0em");
    expect(markup).toContain('role="doc-noteref"');
    expect(markup).toContain('href="#reader-chapter-two-note-one"');
    expect(markup).toContain("<sup>");
    expect(markup).toContain("<sub>");
    expect(markup).toContain("&lt;tag&gt; &amp; value.");
  });
});
