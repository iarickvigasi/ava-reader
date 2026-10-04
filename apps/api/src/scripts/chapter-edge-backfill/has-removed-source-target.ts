import type { ReaderPackage } from '../../reader/reader-types';

// Keep supported inline/image/note/list/cell targets intact instead of guessing a migration.
export function hasRemovedSourceTarget(
  pkg: ReaderPackage,
  removed: Set<string>,
): boolean {
  return pkg.chapters.some((chapter) => visit(chapter.blocks));

  function visit(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(visit);
    const record = value as Record<string, unknown>;
    const target = record.target as { chapterId?: unknown } | undefined;
    if (
      target &&
      typeof target.chapterId === 'string' &&
      removed.has(target.chapterId)
    )
      return true;
    return Object.values(record).some(visit);
  }
}
