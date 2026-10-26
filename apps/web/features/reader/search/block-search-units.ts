import type { ReaderBlock } from "@/lib/api-types";

export function blockSearchUnits(block: ReaderBlock) {
  if (block.kind === "image") return [];
  const groups =
    block.kind === "list"
      ? block.items.map((item) => item.inlines)
      : [block.inlines];
  let offset = 0;
  return groups.map((inlines) => {
    const text = inlines
      .map((inline) => (inline.kind === "text" ? inline.text : ""))
      .join("");
    const unit = { text, offset };
    offset += text.length;
    return unit;
  });
}
