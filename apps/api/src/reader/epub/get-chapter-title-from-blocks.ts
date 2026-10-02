import type { ReaderBlock } from '../reader-types';

const PARAGRAPH_TITLE_MAX_LENGTH = 80;
const STYLED_HEADING_MIN_SCALE = 1.2;

export function getChapterTitleFromBlocks(
  blocks: ReaderBlock[],
  allowParagraphTitle = true,
): string | null {
  const opening = blocks.filter(
    (block) => block.kind !== 'image' && block.text.trim(),
  );
  const first = opening[0];
  if (!first) return null;
  const headings: string[] = [];
  for (const block of opening) {
    if (!isOpeningHeading(block)) break;
    const text = block.text.replace(/\s+/gu, ' ').trim();
    if (
      !headings.some((heading) => heading.toLowerCase() === text.toLowerCase())
    )
      headings.push(text);
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

function isOpeningHeading(block: ReaderBlock): boolean {
  return (
    block.kind === 'heading' ||
    (block.kind === 'paragraph' &&
      block.align === 'center' &&
      (block.fontSizeScale ?? 1) >= STYLED_HEADING_MIN_SCALE &&
      block.text.trim().length <= PARAGRAPH_TITLE_MAX_LENGTH)
  );
}
