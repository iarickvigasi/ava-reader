import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type {
  ReaderBlock,
  ReaderListBlock,
} from "@/lib/api-types/reader-content";
export function validCanonicalCatalog(
  chapter: BilingualChapter,
  blocks: ReaderBlock[],
  revision: string,
) {
  if (chapter.contentRevision !== revision) return false;
  const leaves: {
    id: string;
    text: string;
    kind: string;
    boundaries?: number[];
  }[] = [];
  const addList = (block: ReaderListBlock) => {
    for (const item of block.items) {
      leaves.push({
        ...item,
        kind: "list_item",
        boundaries: item.canonicalText?.codepoint_utf16,
      });
      item.children?.forEach(addList);
    }
  };
  for (const block of blocks) {
    if (block.kind === "list") addList(block);
    else if (block.kind === "table")
      for (const cell of [...block.cells].sort(
        (a, b) => a.row - b.row || a.column - b.column,
      ))
        leaves.push({
          ...cell,
          kind: "cell",
          boundaries: cell.canonicalText?.codepoint_utf16,
        });
    else
      leaves.push({
        ...block,
        boundaries: block.canonicalText?.codepoint_utf16,
      });
  }
  let index = 0;
  for (const leaf of leaves) {
    let end = 0;
    let count = 0;
    while (chapter.units[index]?.blockId === leaf.id) {
      const unit = chapter.units[index++];
      count++;
      const kind =
        leaf.kind === "image"
          ? "image"
          : leaf.kind === "code" || leaf.kind === "separator"
            ? "literal"
            : "sentence";
      if (
        unit.kind !== kind ||
        (kind === "sentence" && !unit.text.trim()) ||
        unit.itemId !== undefined ||
        unit.startOffset < end ||
        unit.endOffset > leaf.text.length ||
        leaf.text.slice(end, unit.startOffset).trim() ||
        leaf.text.slice(unit.startOffset, unit.endOffset) !== unit.text ||
        (leaf.boundaries &&
          (!leaf.boundaries.includes(unit.startOffset) ||
            !leaf.boundaries.includes(unit.endOffset)))
      )
        return false;
      if (
        kind !== "sentence" &&
        (count !== 1 ||
          unit.startOffset !== 0 ||
          unit.endOffset !== leaf.text.length)
      )
        return false;
      end = unit.endOffset;
    }
    if (
      leaf.text.slice(end).trim() ||
      ((leaf.kind === "image" ||
        leaf.kind === "separator" ||
        leaf.kind === "code") &&
        count !== 1)
    )
      return false;
  }
  return index === chapter.units.length;
}
