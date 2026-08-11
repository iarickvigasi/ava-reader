import type {
  ReaderPackage,
  ReadingProgressIndex,
} from '../../reader/reader-types';
import { applyPurposesToIndex } from './apply-to-index';
import { estimateBodyPageCount } from './body-page-count';
import { chapter, paragraph, plainProse } from './chapter.fixture';
import { createCountedLookup } from './counted-chapters';
import type { ChapterPurposeAnalysis } from './finalize-analysis';

const analysis: ChapterPurposeAnalysis = {
  chapters: [
    { chapterId: 'body', confidence: 'high', counted: true, purpose: 'BODY' },
    {
      chapterId: 'notes',
      confidence: 'high',
      counted: false,
      purpose: 'NOTES',
    },
  ],
  lowConfidence: false,
  version: 1,
};

describe('createCountedLookup', () => {
  const counts = createCountedLookup(analysis);

  it('honours the analysis for chapters it knows', () => {
    expect(counts('body')).toBe(true);
    expect(counts('notes')).toBe(false);
  });

  it('counts a chapter the analysis never mentioned', () => {
    expect(counts('unmentioned')).toBe(true);
  });
});

// These two used to answer this question independently, with opposite
// defaults: progress counted an unrecognised chapter, reading time dropped it.
// They cannot be allowed to drift, so the agreement is pinned here rather than
// left to the fact that both happen to derive from one package today.
describe('progress and reading time agree on an unrecognised chapter', () => {
  const CHAPTER_BLOCKS = 10;

  const index: ReadingProgressIndex = {
    chapters: ['body', 'notes', 'unmentioned'].map((chapterId) => ({
      blockIds: Array.from(
        { length: CHAPTER_BLOCKS },
        (_, i) => `${chapterId}::b${i + 1}`,
      ),
      chapterId,
      label: chapterId,
      title: chapterId,
    })),
    toc: [],
    totalBlocks: 3 * CHAPTER_BLOCKS,
    version: 1,
  };

  const readerPackage: ReaderPackage = {
    chapters: ['body', 'notes', 'unmentioned'].map((chapterId, spineIndex) =>
      chapter({
        blocks: [paragraph(plainProse(500))],
        chapterId,
        spineIndex,
      }),
    ),
    manifest: {
      authors: [],
      language: 'en',
      sourceChecksum: 'abc',
      title: 'A Book',
      totalBlocks: 3,
      totalChapters: 3,
    },
    toc: [],
    version: 2,
  };

  it('both include it', () => {
    const patched = applyPurposesToIndex(index, analysis);
    const unmentioned = patched.chapters.find(
      (entry) => entry.chapterId === 'unmentioned',
    );

    // Progress counts it: body + unmentioned, notes excluded.
    expect(unmentioned?.counted).toBe(true);
    expect(patched.bodyBlocks).toBe(2 * CHAPTER_BLOCKS);

    // Reading time must count the same two chapters. Each fixture chapter is
    // 3248 characters — two pages at 1800 per page — so counting both gives 4.
    // The old divergent default dropped `unmentioned` and returned 2.
    expect(estimateBodyPageCount(readerPackage, analysis)).toBe(4);
  });
});
