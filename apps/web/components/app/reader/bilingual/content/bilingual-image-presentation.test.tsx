import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReaderMeasurementContext } from "../../content/reader-measurement-context";
import { BilingualFlowContent } from "./bilingual-flow-content";
import { renderImage, styledImage } from "./bilingual-affix-test-fixture";
import { attribute, flowChapter, markupNodes } from "./flow-test-fixture";

describe("bilingual source illustration fidelity", () => {
  it("keeps finite presentation, geometry and owned image destinations", () => {
    const html = renderImage("source");
    const figure = markupNodes(html, "figure")[0];
    expect(attribute(figure, "style")).toContain("margin-top:0em");
    expect(attribute(figure, "style")).toContain("margin-bottom:0.25em");
    expect(attribute(figure, "style")).toContain("margin-inline-start:1em");
    expect(attribute(figure, "style")).toContain("text-align:center");
    expect(attribute(figure, "style")).toContain("font-style:normal");
    expect(attribute(figure, "data-block-id")).toBe("image");
    const img = markupNodes(html, "img")[0];
    expect(attribute(img, "width")).toBe("480");
    expect(attribute(img, "height")).toBe("320");
    expect(attribute(img, "style")).toBe("max-height:400px");
    expect(attribute(img, "alt")).toBe("Diagram");
    expect(attribute(markupNodes(html, "a")[0], "href")).toBe(
      "#reader-notes-cell",
    );
    expect(html).not.toContain('href="notes.xhtml#cell"');
  });
  it("keeps canonical intrinsic geometry and translated mirrors without source actions", () => {
    expect(
      attribute(markupNodes(renderImage("source", true), "img")[0], "class"),
    ).toContain("max-w-full");
    const html = renderImage("translation");
    expect(markupNodes(html, "a")).toHaveLength(0);
    expect(html).not.toContain("data-reader-block=");
    expect(attribute(markupNodes(html, "img")[0], "width")).toBe("480");
    expect(attribute(markupNodes(html, "figure")[0], "style")).toContain(
      "margin-bottom:0.25em",
    );
  });
  it("suppresses destinations in hidden measurement", () => {
    const html = renderToStaticMarkup(
      <ReaderMeasurementContext value={true}>
        <BilingualFlowContent
          chapter={flowChapter}
          blocks={[styledImage]}
          unitIndexes={[6]}
          side="source"
          pageHeight={400}
        />
      </ReaderMeasurementContext>,
    );
    expect(attribute(markupNodes(html, "a")[0], "href")).toBeUndefined();
  });
});
