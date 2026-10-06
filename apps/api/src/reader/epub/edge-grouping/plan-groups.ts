import { EDGE_GROUPING_VERSION } from './types';
import { normalizeHrefForLookup } from '../archive';
import type { EdgeGroup, EdgePackage, SourceSection } from './types';

export function planGroups(
  pkg: EdgePackage,
  source: Map<string, SourceSection>,
): EdgeGroup[] {
  if (pkg.edgeGroupingVersion === EDGE_GROUPING_VERSION) return [];
  const paths = pkg.chapters.map((c) => normalizeHrefForLookup(c.href));
  const roles = pkg.chapters.map((c, i) =>
    c.href.includes('#') ||
    paths.indexOf(paths[i]) !== paths.lastIndexOf(paths[i])
      ? 'unknown'
      : (source.get(paths[i])?.role ?? 'unknown'),
  );
  const groups: EdgeGroup[] = [];
  for (let i = 0; i < roles.length; i++) {
    if (
      roles[i] === 'unknown' &&
      !pkg.chapters[i].href.includes('#') &&
      paths.indexOf(paths[i]) === paths.lastIndexOf(paths[i]) &&
      pkg.chapters[i].blocks.length &&
      pkg.chapters[i].blocks.every((block) => block.kind === 'image') &&
      i > 0 &&
      roles[i - 1] === 'front'
    )
      roles[i] = 'front';
  }
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
