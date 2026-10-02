import { enrichOpeningLabel } from './enrich-opening-label';
import type { ReaderBlock } from '../reader-types';
import { createChapterExcerptLabel } from './create-chapter-excerpt-label';

export function resolveChapterFallbackLabel(input: {
  blocks: ReaderBlock[];
  language: string | null;
  bookTitle: string;
  candidateLabel: string | null;
  chapterTitle: string | null;
  spineIndex: number;
}) {
  const normalizedBookTitle = normalizeTitleForComparison(input.bookTitle);
  const candidateLabels = [input.candidateLabel, input.chapterTitle];

  for (const candidate of candidateLabels) {
    if (!candidate?.trim()) {
      continue;
    }

    if (normalizeTitleForComparison(candidate) === normalizedBookTitle) {
      continue;
    }

    return enrichOpeningLabel(candidate, input.chapterTitle);
  }

  return createChapterExcerptLabel(input);
}

function normalizeTitleForComparison(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
