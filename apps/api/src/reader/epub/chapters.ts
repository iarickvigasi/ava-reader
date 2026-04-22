import type { ReaderBlock } from '../reader-types';

export function createChapterId(spineIndex: number, href: string) {
  const base =
    href
      .split('/')
      .at(-1)
      ?.replace(/\.[^.]+$/, '') ?? 'chapter';
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `chapter-${spineIndex + 1}${slug ? `-${slug}` : ''}`;
}

export function getChapterTitleFromBlocks(blocks: ReaderBlock[]) {
  for (const block of blocks) {
    if (block.kind === 'heading' && block.text.trim().length > 0) {
      return block.text.trim();
    }
  }

  return null;
}

export function resolveChapterFallbackLabel(input: {
  bookTitle: string;
  candidateLabel: string | null;
  chapterTitle: string | null;
  spineIndex: number;
}) {
  const normalizedBookTitle = normalizeTitleForComparison(input.bookTitle);
  const candidateLabels = [input.candidateLabel, input.chapterTitle];

  for (const candidate of candidateLabels) {
    if (!candidate) {
      continue;
    }

    if (normalizeTitleForComparison(candidate) === normalizedBookTitle) {
      continue;
    }

    return candidate;
  }

  return `Chapter ${input.spineIndex + 1}`;
}

function normalizeTitleForComparison(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
