import type { ReaderChapter } from '../../reader/reader-types';
import { buildChapterSignals, type ChapterSignals } from './chapter-signals';
import { normalizeChapterTitle } from './normalize-title';
import { sampleChapterText } from './sample-text';

/**
 * One chapter compressed for the prompt. Built entirely from the reader
 * package — no AI is involved in producing a digest, which is what keeps the
 * whole analysis to a single request per book.
 */
export type ChapterDigest = {
  chapterId: string;
  index: number;
  sample: string;
  signals: ChapterSignals;
  title: string;
  wordCount: number;
};

function buildChapterDigest(input: {
  chapter: ReaderChapter;
  chapterIndex: number;
  totalChapters: number;
}): ChapterDigest {
  const { chapter, chapterIndex, totalChapters } = input;
  const signals = buildChapterSignals({ chapter, chapterIndex, totalChapters });

  return {
    chapterId: chapter.chapterId,
    index: chapterIndex,
    sample: sampleChapterText(chapter),
    signals,
    title: normalizeChapterTitle({
      label: chapter.label,
      spineIndex: chapter.spineIndex,
      title: chapter.title,
    }),
    wordCount: signals.wordCount,
  };
}

export function buildChapterDigests(
  chapters: ReaderChapter[],
): ChapterDigest[] {
  return chapters.map((chapter, chapterIndex) =>
    buildChapterDigest({
      chapter,
      chapterIndex,
      totalChapters: chapters.length,
    }),
  );
}
