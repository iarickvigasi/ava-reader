import { decodeXmlEntities } from '../../shared/xml-entities';
import type { ReaderPackage, ReadingProgressIndex } from '../reader-types';
import { normalizeTocDisplayText } from '../toc-display-text';

// Builds the compact progress index from a fully-parsed reader package. Used
// by the processing pipeline (eagerly) and by the reader service (as a lazy
// back-fill for legacy DERIVED_READER rows that predate this column).
export function buildReadingProgressIndex(
  readerPackage: ReaderPackage,
): ReadingProgressIndex {
  return {
    chapters: readerPackage.chapters.map((chapter) => ({
      blockIds: chapter.blocks.map((block) => block.id),
      chapterId: chapter.chapterId,
      label: chapter.label,
      title: chapter.title,
    })),
    toc: readerPackage.toc,
    totalBlocks: readerPackage.manifest.totalBlocks,
    version: 1,
  };
}

// Validates a stored JSON value as a ReadingProgressIndex. Returns null if the
// shape doesn't match (e.g. legacy `null`, or a value written by an older
// schema version). Exported for book-analysis, which patches this same index.
export function parseStoredReadingProgressIndex(
  value: unknown,
): ReadingProgressIndex | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<ReadingProgressIndex>;
  if (
    (candidate.version !== 1 && candidate.version !== 2) ||
    typeof candidate.totalBlocks !== 'number' ||
    !Array.isArray(candidate.chapters) ||
    !Array.isArray(candidate.toc)
  ) {
    return null;
  }
  for (const chapter of candidate.chapters) {
    if (!chapter || !Array.isArray(chapter.blockIds)) {
      return null;
    }
  }
  return normalizeReadingProgressIndexDisplayText(
    candidate as ReadingProgressIndex,
  );
}

function normalizeReadingProgressIndexDisplayText(
  index: ReadingProgressIndex,
): ReadingProgressIndex {
  return {
    ...index,
    chapters: index.chapters.map((chapter) => ({
      ...chapter,
      label: decodeXmlEntities(chapter.label),
      title: decodeXmlEntities(chapter.title),
    })),
    toc: normalizeTocDisplayText(index.toc),
  };
}
