import type { DefaultTreeAdapterTypes } from "parse5";
import { createDescriptionBuilder } from "./create-description-builder";
import type { DescriptionBlock, DescriptionMarks } from "./types";

const OMITTED = new Set([
  "script", "style", "template", "noscript", "iframe", "object", "embed", "svg", "math",
  "img", "picture", "video", "audio", "canvas", "form", "input", "button", "select",
  "textarea", "head", "title", "meta", "link", "base",
]);
const PARAGRAPHS = new Set([
  "p", "div", "section", "article", "header", "footer", "main", "aside", "nav",
  "h1", "h2", "h3", "h4", "h5", "h6", "address", "pre", "figure", "figcaption",
  "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "li", "hr",
]);

export function normalizeDescriptionNodes(
  nodes: DefaultTreeAdapterTypes.ChildNode[],
  marks: DescriptionMarks = { bold: false, italic: false },
): DescriptionBlock[] {
  const builder = createDescriptionBuilder();

  function visit(node: DefaultTreeAdapterTypes.ChildNode, inherited: DescriptionMarks) {
    if ("value" in node) {
      builder.text(node.value, inherited);
      return;
    }
    if (!("tagName" in node) || OMITTED.has(node.tagName)) return;
    const tag = node.tagName;
    const emphasis = {
      bold: inherited.bold || tag === "b" || tag === "strong",
      italic: inherited.italic || tag === "i" || tag === "em",
    };
    if (tag === "br") {
      builder.lineBreak();
      return;
    }
    if (tag === "blockquote") {
      const children = normalizeDescriptionNodes(node.childNodes, emphasis);
      if (children.length) builder.append({ type: "quote", children });
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const items = node.childNodes
        .map((child) => normalizeDescriptionNodes(
          "tagName" in child && child.tagName === "li" ? child.childNodes : [child],
          emphasis,
        ))
        .filter((item) => item.length > 0);
      if (items.length) builder.append({ type: "list", ordered: tag === "ol", items });
      return;
    }
    if (PARAGRAPHS.has(tag)) builder.boundary();
    for (const child of node.childNodes) visit(child, emphasis);
    if (PARAGRAPHS.has(tag)) builder.boundary();
  }

  for (const node of nodes) visit(node, marks);
  return builder.finish();
}
