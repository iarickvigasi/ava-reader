import type { ReaderChapter } from '../reader-types';

// Run after splitting/assigning IDs so merging never renumbers existing blocks.
export function mergePictureChapters(source: ReaderChapter[]) {
  const chapters: ReaderChapter[] = [];
  let pending: ReaderChapter[] = [];
  for (const chapter of source) {
    if (chapter.blocks.every((block) => block.kind === 'image')) {
      pending.push(chapter);
      continue;
    }
    chapters.push({
      ...chapter,
      blocks: [...pending.flatMap((item) => item.blocks), ...chapter.blocks],
    });
    pending = [];
  }
  chapters.push(...pending);
  return chapters.map((chapter, spineIndex) => ({
    ...chapter,
    spineIndex,
    previousChapterId: chapters[spineIndex - 1]?.chapterId ?? null,
    nextChapterId: chapters[spineIndex + 1]?.chapterId ?? null,
  }));
}
