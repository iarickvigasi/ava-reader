import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { ReaderStructuredList } from "./reader-structured-list";

it("renders exact ordered marker families without adding text or losing start", () => {
  const list = canonicalFixture().chapters[0].blocks.find(
    (block) => block.kind === "list",
  );
  if (list?.kind !== "list") throw new Error("Missing authored list");
  for (const markerStyle of [
    "decimal",
    "lower-alpha",
    "upper-alpha",
    "lower-roman",
    "upper-roman",
  ] as const) {
    const html = renderToStaticMarkup(
      <ReaderStructuredList
        block={{ ...list, markerStyle }}
        chapterId="chapter-one"
      />,
    );
    expect(html).toContain(`list-style-type:${markerStyle}`);
    expect(html).toContain('start="3"');
    expect(html).toContain(list.items[0].text);
  }
});
