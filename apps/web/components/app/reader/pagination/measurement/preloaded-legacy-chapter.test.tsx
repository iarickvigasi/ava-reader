import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment } from "parse5";
import { expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { PreloadedChapter } from "./preloaded-chapter";
vi.mock("../../overlays/highlights/highlights-context", () => ({
  useHighlightsContext: () => ({ highlights: [] }),
}));
vi.mock("../../overlays/ai-comments/ai-comments-context", () => ({
  useAiCommentsContext: () => ({ comments: [] }),
}));
import { nodes, text, attr } from "./measurement-markup-fixture";
it("also removes legacy EPUB anchors and links without changing their text", () => {
  const chapter = {
    ...canonicalFixture().chapters[0],
    chapterId: "legacy",
    title: "Legacy",
    blocks: [
      {
        id: "p",
        kind: "paragraph" as const,
        anchorId: "publisher-anchor",
        text: "Original link",
        inlines: [
          {
            kind: "text" as const,
            text: "Original link",
            href: "#publisher-anchor",
          },
        ],
      },
    ],
  };
  const markup = renderToStaticMarkup(
    <PreloadedChapter
      articleStyle={{}}
      chapter={chapter}
      pageBoxHeight={700}
      pageBoxWidth={520}
      setArticleRef={() => {}}
      setPageBoxRef={() => {}}
    />,
  );
  const elements = nodes(parseFragment(markup));
  expect(elements.some((n) => attr(n, "id") || attr(n, "href"))).toBe(false);
  expect(markup).toContain('data-block-id="p"');
  expect(text(parseFragment(markup))).toBe("Original link");
});
