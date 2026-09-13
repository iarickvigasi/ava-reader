import type { DescriptionBlock, DescriptionInline, DescriptionMarks } from "./types";

// Collect inline runs between block boundaries, deferring breaks so empty publisher
// spacers never produce empty paragraphs or leading/trailing line breaks.
export function createDescriptionBuilder() {
  const blocks: DescriptionBlock[] = [];
  let children: DescriptionInline[] = [];
  let pendingBreaks = 0;

  function trimEnd() {
    const last = children.at(-1);
    if (last?.type === "text") {
      last.text = last.text.trimEnd();
      if (!last.text) children.pop();
    }
  }

  function boundary() {
    trimEnd();
    if (children.length) blocks.push({ type: "paragraph", children });
    children = [];
    pendingBreaks = 0;
  }

  function text(raw: string, marks: DescriptionMarks) {
    let value = raw.replace(/\s+/gu, " ");
    if (!value.trim() && (pendingBreaks || !children.length)) return;
    if (pendingBreaks > 1) boundary();
    if (pendingBreaks === 1) {
      trimEnd();
      children.push({ type: "break" });
      pendingBreaks = 0;
    }
    const last = children.at(-1);
    if (!last || last.type === "break" || last.text.endsWith(" ")) {
      value = value.trimStart();
    }
    if (!value) return;
    if (last?.type === "text" && last.bold === marks.bold && last.italic === marks.italic) {
      last.text += value;
    } else {
      children.push({ type: "text", text: value, ...marks });
    }
  }

  return {
    text,
    boundary,
    lineBreak() {
      if (children.length) pendingBreaks += 1;
    },
    append(block: DescriptionBlock) {
      boundary();
      blocks.push(block);
    },
    finish() {
      boundary();
      return blocks;
    },
  };
}
