import type { ReaderBlock } from "@/lib/api-types/reader";
import type { TocChapterEntry } from "@/features/reader/toc";

const MIN_HEADING_SCALE = 1.2;
const MAX_HEADING_LENGTH = 80;

export function hasRepairableOpening(
  blocks: ReaderBlock[],
  entry: TocChapterEntry,
  bookTitle: string,
) {
  if (entry.spineIndex === null) return false;
  const opening = blocks.filter(
    (block) => block.kind !== "image" && block.text.trim(),
  );
  const headings = openingHeadings(opening);
  if (headings.length > 1 && headings.includes(normalize(entry.label)))
    return true;
  const prefix = `${entry.spineIndex + 1}.`;
  const excerpt =
    entry.label === prefix ||
    (entry.label.startsWith(`${prefix} `) && entry.label.endsWith("…"));
  if (!excerpt || normalize(opening[0]?.text ?? "") === normalize(bookTitle))
    return false;
  if (headings.length) return true;
  return (
    !opening.length &&
    entry.label === prefix &&
    blocks.some(
      (block) => block.kind === "image" && /^part\s/i.test(block.alt ?? ""),
    )
  );
}

function openingHeadings(blocks: ReaderBlock[]) {
  const headings: string[] = [];
  for (const block of blocks) {
    const styled =
      block.kind === "paragraph" &&
      block.align === "center" &&
      (block.fontSizeScale ?? 1) >= MIN_HEADING_SCALE &&
      block.text.trim().length <= MAX_HEADING_LENGTH;
    if (block.kind !== "heading" && !styled) break;
    headings.push(normalize(block.text));
  }
  return headings;
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}
