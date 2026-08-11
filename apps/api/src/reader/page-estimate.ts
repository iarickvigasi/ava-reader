import type { ReaderChapter, ReaderPackage } from './reader-types';

const ESTIMATED_CHARACTERS_PER_PAGE = 1_800;

export function countChapterCharacters(chapters: ReaderChapter[]): number {
  return chapters.reduce(
    (chapterSum, chapter) =>
      chapterSum +
      chapter.blocks.reduce(
        (blockSum, block) => blockSum + block.text.length,
        0,
      ),
    0,
  );
}

export function pagesFromCharacters(characters: number): null | number {
  if (characters <= 0) {
    return null;
  }

  return Math.max(1, Math.round(characters / ESTIMATED_CHARACTERS_PER_PAGE));
}

export function estimatePageCount(readerPackage: ReaderPackage): null | number {
  return pagesFromCharacters(countChapterCharacters(readerPackage.chapters));
}
