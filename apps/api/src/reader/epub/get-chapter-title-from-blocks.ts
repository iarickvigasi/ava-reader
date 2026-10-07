import type { ReaderBlock } from '../reader-types';

const PARAGRAPH_TITLE_MAX_LENGTH = 80;
const STYLED_HEADING_MIN_SCALE = 1.125;
const MAX_OPENING_HEADINGS = 3;
const MAX_COMBINED_TITLE_LENGTH = 240;

export function getChapterTitleFromBlocks(
  blocks: ReaderBlock[],
  allowParagraphTitle = true,
): string | null {
  const opening = blocks.filter(
    (block) => block.kind !== 'image' && block.text.trim(),
  );
  const first = opening[0];
  if (!first) return null;
  const structuralOpening =
    /^(?:(?:chapter|part)\s+[\divxlcdm]+|preface)$/i.test(first.text.trim());
  const headings: string[] = [];
  for (const block of opening) {
    if (!isOpeningHeading(block, structuralOpening)) break;
    const text = block.text.replace(/\s+/gu, ' ').trim();
    if (
      !headings.some((heading) => heading.toLowerCase() === text.toLowerCase())
    )
      headings.push(text);
    // Some publishers mark entire copyright pages as semantic headings.
    // Reject the whole group instead of retaining a partial publisher address.
    if (
      headings.length > MAX_OPENING_HEADINGS ||
      headings.join(' / ').length > MAX_COMBINED_TITLE_LENGTH
    )
      return headings[0];
  }
  if (headings.length) return headings.join(' / ');
  if (
    allowParagraphTitle &&
    (first.kind === 'paragraph' || first.kind === 'blockquote') &&
    first.text.trim().length <= PARAGRAPH_TITLE_MAX_LENGTH &&
    opening.length > 1
  )
    return first.text.trim();
  return null;
}

function isOpeningHeading(
  block: ReaderBlock,
  structuralOpening: boolean,
): boolean {
  return (
    block.kind === 'heading' ||
    (block.kind === 'paragraph' &&
      block.align === 'center' &&
      (structuralOpening ||
        (block.fontSizeScale ?? 1) >= STYLED_HEADING_MIN_SCALE) &&
      block.text.trim().length <= PARAGRAPH_TITLE_MAX_LENGTH)
  );
}
