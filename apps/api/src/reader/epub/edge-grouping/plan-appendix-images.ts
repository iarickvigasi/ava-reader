import type { EdgeGroup, EdgePackage, EdgeRole } from './types';

export function planAppendixImages(
  pkg: EdgePackage,
  roles: EdgeRole[],
): EdgeGroup[] {
  const groups: EdgeGroup[] = [];
  for (let i = 0; i < pkg.chapters.length; i++) {
    if (roles[i] !== 'appendix') continue;
    let end = i + 1;
    while (end < pkg.chapters.length) {
      const chapter = pkg.chapters[end];
      if (
        !chapter.blocks.length ||
        !chapter.blocks.every((block) => block.kind === 'image')
      )
        break;
      end++;
    }
    if (end > i + 1)
      groups.push({
        label: pkg.chapters[i].label,
        chapterIds: pkg.chapters
          .slice(i, end)
          .map((chapter) => chapter.chapterId),
      });
    i = end - 1;
  }
  return groups;
}
