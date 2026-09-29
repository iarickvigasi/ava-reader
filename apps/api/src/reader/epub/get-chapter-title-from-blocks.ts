import type { ReaderBlock } from '../reader-types';

const PARAGRAPH_TITLE_MAX_LENGTH = 80;
const CHAPTER_NUMBER = /^(?:(?:chapter|part)\s+)?(?:\d+|[ivxlcdm]+)[.:]?$/i;

export function getChapterTitleFromBlocks(
  blocks: ReaderBlock[],
  allowParagraphTitle = true,
): string | null {
  const opening = blocks.filter(
    (block) => block.kind !== 'image' && block.text.trim(),
  );
  const first = opening[0];
  if (!first) return null;

  if (first.kind === 'heading') {
    const title = first.text.trim();
    const next = opening[1];
    // Publishers often separate the authored number from the actual title.
    return CHAPTER_NUMBER.test(title) && next?.kind === 'heading'
      ? next.text.trim()
      : title;
  }

  // Only the opening can supply a title, never a later subsection heading.
  if (
    allowParagraphTitle &&
    (first.kind === 'paragraph' || first.kind === 'blockquote') &&
    first.text.trim().length <= PARAGRAPH_TITLE_MAX_LENGTH &&
    opening.length > 1
  )
    return first.text.trim();
  return null;
}
