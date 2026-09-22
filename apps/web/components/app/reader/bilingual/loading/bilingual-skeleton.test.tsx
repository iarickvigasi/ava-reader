import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BilingualFlowContent } from "../content/bilingual-flow-content";
import { BilingualPageSkeleton } from "./bilingual-page-skeleton";
import { BilingualStatus } from "./bilingual-status";
import {
  attribute,
  flowBlocks,
  flowChapter,
  markupNodes,
  markupText,
} from "../content/flow-test-fixture";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

describe("bilingual loading placeholders", () => {
  it("keeps completed text and places an inaccessible skeleton in the missing sentence's paragraph", () => {
    const chapter = { ...flowChapter, translations: { one: "Uno." } };
    const html = renderToStaticMarkup(
      <BilingualFlowContent
        chapter={chapter}
        blocks={flowBlocks}
        unitIndexes={[0, 1]}
        side="translation"
        pageHeight={400}
      />,
    );
    expect(markupNodes(html, "p")).toHaveLength(1);
    expect(markupText(markupNodes(html, "p")[0])).toBe("Uno. Two.");
    const skeleton = markupNodes(html, "span").find(
      (span) => attribute(span, "data-bilingual-skeleton") !== undefined,
    )!;
    expect(attribute(skeleton, "aria-hidden")).toBe("true");
    expect(attribute(skeleton, "class")).toContain("text-transparent");
    expect(html).not.toContain("data-reader-block=");
  });

  it("replaces the skeleton with the completed sentence while leaving paragraph structure intact", () => {
    const html = renderToStaticMarkup(
      <BilingualFlowContent
        chapter={flowChapter}
        blocks={flowBlocks}
        unitIndexes={[0, 1]}
        side="translation"
        pageHeight={400}
      />,
    );
    expect(markupText(markupNodes(html, "p")[0])).toBe("Uno. Dos.");
    expect(html).not.toContain("data-bilingual-skeleton");
  });

  it("uses shapes for initial preparation and hides ordinary loading status visually", () => {
    const html = renderToStaticMarkup(<BilingualPageSkeleton />);
    expect(html).toContain('role="status"');
    expect(markupText(markupNodes(html, "div")[0])).toBe("");
    const status = renderToStaticMarkup(
      <BilingualStatus pending error={null} offline={false} retry={() => {}} />,
    );
    expect(status).toContain('class="sr-only"');
    expect(status).not.toContain("preparing");
  });
});
