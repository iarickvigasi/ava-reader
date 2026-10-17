import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment } from "parse5";
import { expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { ReaderArticle } from "../../content/reader-article";
import { PreloadedChapter } from "./preloaded-chapter";
vi.mock("../../overlays/highlights/highlights-context", () => ({
  useHighlightsContext: () => ({ highlights: [] }),
}));
vi.mock("../../overlays/ai-comments/ai-comments-context", () => ({
  useAiCommentsContext: () => ({ comments: [] }),
}));
import { nodes, text, attr } from "./measurement-markup-fixture";
it("keeps hidden full chapters measurable without stealing live passage or table targets", () => {
  for (const chapter of canonicalFixture().chapters) {
    const visible = parseFragment(
      renderToStaticMarkup(
        <ReaderArticle
          blocks={chapter.blocks}
          chapterId={chapter.chapterId}
          pageHeight={700}
        />,
      ),
    );
    const hidden = parseFragment(
      renderToStaticMarkup(
        <PreloadedChapter
          articleStyle={{}}
          chapter={chapter}
          pageBoxHeight={700}
          pageBoxWidth={520}
          setArticleRef={() => {}}
          setPageBoxRef={() => {}}
        />,
      ),
    );
    const liveNodes = nodes(visible),
      measuredNodes = nodes(hidden);
    expect(
      measuredNodes.some((n) =>
        n.attrs.some((a) =>
          [
            "id",
            "href",
            "headers",
            "aria-describedby",
            "aria-labelledby",
            "tabindex",
          ].includes(a.name),
        ),
      ),
    ).toBe(false);
    expect(liveNodes.some((n) => attr(n, "id"))).toBe(true);
    const leaves = (elements: typeof liveNodes) =>
      elements
        .filter((n) => attr(n, "data-reader-block") === "true")
        .map((n) => ({
          id: attr(n, "data-block-id"),
          chapter: attr(n, "data-chapter-id"),
          kind: attr(n, "data-reader-block-kind"),
          text: text(n),
          style: attr(n, "style"),
        }));
    expect(leaves(measuredNodes)).toEqual(leaves(liveNodes));
    expect(text(hidden)).toBe(text(visible));
    for (const attribute of ["scope", "start", "alt", "width", "height"])
      expect(measuredNodes.flatMap((n) => attr(n, attribute) ?? [])).toEqual(
        liveNodes.flatMap((n) => attr(n, attribute) ?? []),
      );
  }
});
