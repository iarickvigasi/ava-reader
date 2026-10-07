import { createFallbackToc, resolveTocNodes } from './toc';
import type { ReaderPackage } from '../reader-types';
import { readSourceSections } from './edge-grouping/read-source-sections';
import { planGroups } from './edge-grouping/plan-groups';
import { regroupPackage } from './edge-grouping/regroup-package';
import { mergePictureChapters } from './merge-picture-chapters';
import { remapMergedToc } from './remap-merged-toc';

export async function normalizeEpubChapters(
  buffer: Buffer,
  source: ReaderPackage,
  authoredToc: boolean,
) {
  const sections = await readSourceSections(buffer, source);
  const groups = planGroups(source, sections);
  const grouped = regroupPackage(source, groups);
  const separate = new Set(groups.map((group) => group.chapterIds[0]));
  const chapters = mergePictureChapters(grouped.chapters, separate);
  const toc = authoredToc
    ? remapMergedToc(grouped.toc, grouped.chapters, chapters)
    : resolveTocNodes(createFallbackToc(chapters), chapters);
  return {
    ...grouped,
    chapters,
    toc,
    manifest: { ...grouped.manifest, totalChapters: chapters.length },
  };
}
