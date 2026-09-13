import { describe, expect, it } from "vitest";

import { descriptionText } from "./fixtures/description-text";
import { parseBookDescription } from "./parse-book-description";

describe("parseBookDescription", () => {
  it("preserves plain text paragraphs, punctuation, and angle-bracket prose", () => {
    const blocks = parseBookDescription("  First line\r\ncontinued.\r\n\r\n2 < 3 and 5 > 4.  ");
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
    expect(descriptionText(blocks)).toBe("First line\ncontinued.\n\n2 < 3 and 5 > 4.");
  });

  it("keeps container boundaries while flattening wrappers", () => {
    const blocks = parseBookDescription("<div><div>First</div><div><p>Second</p></div>Third</div>");
    expect(descriptionText(blocks)).toBe("First\n\nSecond\n\nThird");
    expect(blocks.every((block) => block.type === "paragraph")).toBe(true);
  });

  it("preserves single breaks and turns repeated breaks into paragraph spacing", () => {
    const blocks = parseBookDescription("<p>First<br>line<br><br><br>Second</p>");
    expect(descriptionText(blocks)).toBe("First\nline\n\nSecond");
    expect(blocks).toHaveLength(2);
  });

  it("preserves spaces around emphasized words and decodes named and numeric entities", () => {
    const blocks = parseBookDescription("<p>The <b>bold <i>title</i></b> &amp; its&nbsp;story " +
      "&#8212; &#x2014; &ldquo;quoted&rdquo;.</p>");
    expect(descriptionText(blocks).replace(/\u00a0/g, " ")).toBe(
      "The bold title & its story — — “quoted”.",
    );
    expect(blocks[0]).toMatchObject({ type: "paragraph", children: expect.arrayContaining([
      expect.objectContaining({ type: "text", text: "title", bold: true, italic: true }),
    ]) });
  });

  it.each([null, "", " \n\t ", "<div><p></p><br>&nbsp;</div>", "<p>&nbsp; \n</p>"])(
    "returns no content for an empty description: %s", (source) => {
      expect(parseBookDescription(source)).toEqual([]);
    },
  );

  it("retains repeated paragraphs", () => {
    expect(descriptionText(parseBookDescription("<p>Again.</p><p>Again.</p>")))
      .toBe("Again.\n\nAgain.");
  });

  it("recovers readable text and emphasis from malformed HTML", () => {
    const blocks = parseBookDescription("<p>First <b>bold<p>Second <i>italic");
    expect(descriptionText(blocks)).toBe("First bold\n\nSecond italic");
    expect(blocks[0]).toMatchObject({ children: expect.arrayContaining([
      expect.objectContaining({ type: "text", text: "bold", bold: true }),
    ]) });
  });

  it("keeps list order, nesting, and quote boundaries", () => {
    const blocks = parseBookDescription("<blockquote><p>A quote.</p></blockquote>" +
      "<ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol>");
    expect(blocks[0]).toMatchObject({ type: "quote", children: [{ type: "paragraph" }] });
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true, items: [
      [{ type: "paragraph" }, { type: "list", ordered: false }], [{ type: "paragraph" }],
    ] });
    expect(descriptionText(blocks)).toBe("A quote.\n\nFirst\n\nNested\n\nSecond");
  });
});
