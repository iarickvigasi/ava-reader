import { EDGE_GROUPING_VERSION } from './types';
import { regroupToc } from './regroup-toc';
import type { EdgeGroup, EdgePackage } from './types';

export function regroupPackage(
  pkg: EdgePackage,
  groups: EdgeGroup[],
): EdgePackage {
  if (!groups.length) return pkg;
  const byId = new Map(pkg.chapters.map((c) => [c.chapterId, c]));
  const owners = new Map(
    groups.flatMap((g) => g.chapterIds.map((id) => [id, g] as const)),
  );
  const chapters = pkg.chapters
    .flatMap((chapter) => {
      const group = owners.get(chapter.chapterId);
      if (!group) return [chapter];
      if (group.chapterIds[0] !== chapter.chapterId) return [];
      return [
        {
          ...chapter,
          label: group.label,
          title: group.label,
          blocks: group.chapterIds.flatMap((id) => byId.get(id)!.blocks),
        },
      ];
    })
    .map((chapter, index, all) => ({
      ...chapter,
      spineIndex: index,
      previousChapterId: all[index - 1]?.chapterId ?? null,
      nextChapterId: all[index + 1]?.chapterId ?? null,
    }));
  return {
    ...pkg,
    edgeGroupingVersion: EDGE_GROUPING_VERSION,
    chapters,
    manifest: { ...pkg.manifest, totalChapters: chapters.length },
    toc: regroupToc(pkg.toc, chapters, groups),
  };
}
