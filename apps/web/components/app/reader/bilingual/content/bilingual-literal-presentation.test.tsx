import { describe, expect, it } from "vitest";
import { literalBlocks, renderLiterals } from "./bilingual-affix-test-fixture";
import { attribute, markupNodes, markupText } from "./flow-test-fixture";

describe("literal bilingual source structures", () => {
  for (const canonical of [false, true]) {
    for (const side of ["source", "translation"] as const) {
      it(`preserves separator spacing and exact verse/code for ${canonical ? "canonical" : "ordinary"} ${side}`, () => {
        const html = renderLiterals(side, canonical);
        const hr = markupNodes(html, "hr")[0];
        expect(attribute(hr, "style")).toBe(
          "color:#123456;margin-top:0.2em;margin-bottom:0em",
        );
        const paragraphs = markupNodes(html, "p");
        expect(markupText(paragraphs[0])).toBe(literalBlocks[1].text);
        expect(attribute(paragraphs[0], "style")).toContain(
          "white-space:pre-wrap",
        );
        const pre = markupNodes(html, "pre")[0];
        expect(markupText(pre)).toBe(literalBlocks[2].text);
        expect(attribute(pre, "style")).toContain("white-space:pre-wrap");
        expect(html).not.toContain("data-bilingual-missing");
        expect(
          markupNodes(html, "span").filter((n) =>
            attribute(n, "data-bilingual-unit-id"),
          ),
        ).toHaveLength(3);
        expect(
          markupNodes(html, "span").filter(
            (n) => attribute(n, "data-reader-block") === "true",
          ),
        ).toHaveLength(side === "source" ? 3 : 0);
      });
    }
  }
});
