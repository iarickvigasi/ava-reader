import type { parseBookDescription } from "../parse-book-description";

export function descriptionText(blocks: ReturnType<typeof parseBookDescription>): string {
  return blocks.map((block) => {
    if (block.type === "quote") return descriptionText(block.children);
    if (block.type === "list") return block.items.map(descriptionText).join("\n\n");
    return block.children.map((inline) => inline.type === "text" ? inline.text : "\n").join("");
  }).join("\n\n");
}
