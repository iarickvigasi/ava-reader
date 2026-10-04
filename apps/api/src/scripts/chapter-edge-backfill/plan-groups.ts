import { normalizeHrefForLookup } from '../../reader/epub/archive';
import type { EdgeGroup, EdgePackage, SourceSection } from './types';

export function planGroups(
  pkg: EdgePackage,
  source: Map<string, SourceSection>,
): EdgeGroup[] {
  if (pkg.edgeGroupingVersion === 1) return [];
  const paths = pkg.chapters.map((c) => normalizeHrefForLookup(c.href));
  const roles = pkg.chapters.map((c, i) =>
    c.href.includes('#') ||
    paths.indexOf(paths[i]) !== paths.lastIndexOf(paths[i])
      ? 'unknown'
      : (source.get(paths[i])?.role ?? 'unknown'),
  );
  const groups: EdgeGroup[] = [];
  let end = 0;
  while (end < roles.length && ['front', 'contents'].includes(roles[end]))
    end++;
  // No identifiable middle: do not collapse a book made entirely of small pieces.
  if (end === roles.length) return [];
  collect(0, end, 'front', 'Front matter');
  let start = roles.length;
  while (start > end && ['footnote', 'back'].includes(roles[start - 1]))
    start--;
  collect(start, roles.length, 'footnote', 'Footnotes');
  return groups;

  function collect(
    from: number,
    to: number,
    role: string,
    label: EdgeGroup['label'],
  ) {
    for (let i = from; i < to; ) {
      if (roles[i] !== role) {
        i++;
        continue;
      }
      const first = i;
      while (i < to && roles[i] === role) i++;
      if (i - first > 1)
        groups.push({
          label,
          chapterIds: pkg.chapters.slice(first, i).map((c) => c.chapterId),
        });
    }
  }
}
