import type { Prisma } from '@prisma/client';
import { parseStoredReadingProgressIndex } from '../../reader/progress/reading-progress-index';
import type { ReadingProgressIndex } from '../../reader/reader-types';
import { relabelToc, type LabelChange } from './relabel-package';

export function relabelIndex(value: Prisma.JsonValue, changes: LabelChange[]) {
  if (value === null) return null;
  if (!parseStoredReadingProgressIndex(value))
    throw new Error('Invalid progress index');
  // Patch the raw index so counted flags, body totals, and unknown fields survive.
  const index = value as unknown as ReadingProgressIndex;
  const labels = new Map(changes.map((change) => [change.chapterId, change]));
  return {
    ...index,
    chapters: index.chapters.map((chapter) => {
      const change = labels.get(chapter.chapterId);
      return change
        ? { ...chapter, label: change.after, title: change.after }
        : chapter;
    }),
    toc: relabelToc(index.toc, labels),
  } as unknown as Prisma.InputJsonValue;
}
