import { describe, expect, it } from "vitest";

import { descriptionText } from "./fixtures/description-text";
import { interstellarHtml, interstellarParagraphs } from "./fixtures/interstellar";
import { nonviolentHtml, nonviolentParagraphs } from "./fixtures/nonviolent-communication";
import { untamedHtml, untamedIntroduction } from "./fixtures/untamed";
import { parseBookDescription } from "./parse-book-description";

describe("publisher description regressions", () => {
  it("keeps both Nonviolent Communication paragraphs and drops the empty opening paragraph", () => {
    const blocks = parseBookDescription(nonviolentHtml);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
    expect(descriptionText(blocks)).toBe(nonviolentParagraphs.join("\n\n"));
    expect(JSON.stringify(blocks)).not.toMatch(/style|text-align|class/);
  });

  it("keeps Interstellar italics and paragraphs without publisher font settings or spacer blocks", () => {
    const blocks = parseBookDescription(interstellarHtml);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
    expect(descriptionText(blocks)).toBe(interstellarParagraphs.join("\n\n"));
    const emphasized = blocks.flatMap((block) => block.type === "paragraph" ? block.children : [])
      .filter((inline) => inline.type === "text" && inline.italic);
    expect(emphasized.map((inline) => inline.type === "text" ? inline.text : "")).toEqual([
      "Interstellar", "Interstellar", "The Science of Interstellar", "Interstellar", "Interstellar",
    ]);
    expect(JSON.stringify(blocks)).not.toMatch(/font-size|font-family|MS Shell|12px/);
  });

  it("flattens Untamed's bold nesting, decodes em dashes, and preserves available source text", () => {
    const blocks = parseBookDescription(untamedHtml);
    const text = descriptionText(blocks);
    expect(text).toContain(untamedIntroduction);
    expect(text).toContain("women—emotionally, spiritually, and physically.");
    expect(text).toContain('"—Elizabeth Gilbert');
    expect(text).toContain("This is how you find yourself.\n\nThere is a voice");
    expect(text.endsWith("telling ourselves to be grateful, hiding...")).toBe(true);
    const inline = blocks.flatMap((block) => block.type === "paragraph" ? block.children : []);
    const introduction = inline.slice(0, inline.findIndex((part) => part.type === "break"));
    expect(introduction.length).toBeGreaterThan(0);
    expect(introduction.every((part) => part.type === "text" && part.bold)).toBe(true);
    expect(inline).toContainEqual(expect.objectContaining({
      type: "text", text: "Love Warrior", bold: true, italic: true,
    }));
    expect(inline).toContainEqual(expect.objectContaining({
      type: "text", text: "Wasn't it all supposed to be more beautiful than this?", italic: true,
    }));
  });
});
