import type { Prisma } from '@prisma/client';
import {
  buildReadingProgressIndex,
  parseStoredReadingProgressIndex,
} from '../../reader/progress/reading-progress-index';
import type { ReaderPackage } from '../../reader/reader-types';
import type { EdgeGroup } from './types';

export function regroupIndex(
  value: Prisma.JsonValue,
  pkg: ReaderPackage,
  groups: EdgeGroup[],
) {
  if (value === null)
    return buildReadingProgressIndex(pkg) as unknown as Prisma.InputJsonValue;
  const old = parseStoredReadingProgressIndex(value);
  if (!old) throw new Error('Invalid progress index');
  const previousBlocks = old.chapters.flatMap((c) => c.blockIds);
  const nextBlocks = pkg.chapters.flatMap((c) => c.blocks.map((b) => b.id));
  if (
    JSON.stringify(previousBlocks) !== JSON.stringify(nextBlocks) ||
    old.totalBlocks !== nextBlocks.length
  )
    throw new Error('Progress index does not match package content');
  const byId = new Map(old.chapters.map((c) => [c.chapterId, c]));
  for (const group of groups) {
    const counts = group.chapterIds.map((id) => {
      const entry = byId.get(id);
      if (!entry) throw new Error(`Missing progress index entry: ${id}`);
      return entry.counted !== false;
    });
    if (counts.some((count) => count !== counts[0]))
      throw new Error(
        'Group has mixed progress-counting flags; manual migration required',
      );
  }
  return {
    ...old,
    toc: pkg.toc,
    chapters: pkg.chapters.map((c) => ({
      ...byId.get(c.chapterId),
      chapterId: c.chapterId,
      label: c.label,
      title: c.title,
      blockIds: c.blocks.map((b) => b.id),
    })),
  } as unknown as Prisma.InputJsonValue;
}
