import type { ReadingProgressIndex } from './reader-types';
import {
  computeProgressMetricsFromIndex,
  parseStoredReadingProgressIndex,
} from './reader.service';

type ChapterSpec = { blocks: number; chapterId: string; counted?: boolean };

function buildIndex(
  chapters: ChapterSpec[],
  version: 1 | 2 = 2,
): ReadingProgressIndex {
  const built = chapters.map((entry) => ({
    blockIds: Array.from(
      { length: entry.blocks },
      (_, i) => `${entry.chapterId}::b${i + 1}`,
    ),
    chapterId: entry.chapterId,
    label: entry.chapterId,
    title: entry.chapterId,
    ...(version === 2 ? { counted: entry.counted ?? true } : {}),
  }));

  return {
    chapters: built,
    toc: [],
    totalBlocks: built.reduce((sum, c) => sum + c.blockIds.length, 0),
    version,
    ...(version === 2
      ? {
          bodyBlocks: built.reduce(
            (sum, c) => (c.counted ? sum + c.blockIds.length : sum),
            0,
          ),
        }
      : {}),
  };
}

function percentAt(
  index: ReadingProgressIndex,
  chapterId: string,
  blockNumber: number,
) {
  return computeProgressMetricsFromIndex(index, {
    blockId: `${chapterId}::b${blockNumber}`,
    chapterId,
    textOffset: 0,
  }).completionPercent;
}

// A novel with front matter, body, and a long apparatus tail — the shape that
// made whole-book progress wrong.
const novel = buildIndex([
  { blocks: 10, chapterId: 'front', counted: false },
  { blocks: 100, chapterId: 'body-1' },
  { blocks: 100, chapterId: 'body-2' },
  { blocks: 40, chapterId: 'notes', counted: false },
  { blocks: 30, chapterId: 'refs', counted: false },
]);

describe('computeProgressMetricsFromIndex', () => {
  describe('a v1 index', () => {
    const legacy = buildIndex(
      [
        { blocks: 50, chapterId: 'one' },
        { blocks: 50, chapterId: 'two' },
      ],
      1,
    );

    it('keeps counting every block, exactly as before', () => {
      expect(percentAt(legacy, 'one', 50)).toBe(50);
      expect(percentAt(legacy, 'two', 50)).toBe(100);
    });
  });

  describe('a v2 index', () => {
    it('divides by body blocks only', () => {
      // 100 of 200 counted blocks read — the 80 uncounted blocks are ignored
      // on both sides of the ratio.
      expect(percentAt(novel, 'body-1', 100)).toBe(50);
    });

    it('reports 0% anywhere in the front matter', () => {
      expect(percentAt(novel, 'front', 1)).toBe(0);
      expect(percentAt(novel, 'front', 10)).toBe(0);
    });

    // The bug this fixes: "currently reading" filters on completionPercent
    // < 100, so a book with a heavy apparatus tail could never leave the shelf.
    it('reports 100% on the last block of the last body chapter', () => {
      expect(percentAt(novel, 'body-2', 100)).toBe(100);
    });

    it('stays at 100% through the notes and references', () => {
      expect(percentAt(novel, 'notes', 1)).toBe(100);
      expect(percentAt(novel, 'refs', 30)).toBe(100);
    });

    it('never exceeds 100%', () => {
      expect(percentAt(novel, 'refs', 30)).toBeLessThanOrEqual(100);
    });

    // A labelling that excludes everything is degenerate — trusting it would
    // pin the reader at 0% for the whole book.
    it('falls back to whole-book counting when nothing counts', () => {
      const allApparatus = buildIndex([
        { blocks: 10, chapterId: 'a', counted: false },
      ]);

      expect(percentAt(allApparatus, 'a', 5)).toBe(50);
    });
  });

  // A realistic non-fiction shape: 15 blocks of front matter, a contents page,
  // ten 100-block body chapters, then 300 blocks of apparatus. 1000 of the
  // 1325 blocks are the actual reading.
  describe('a real book, at the positions a reader would recognise', () => {
    const realistic = buildIndex([
      { blocks: 15, chapterId: 'front', counted: false },
      { blocks: 10, chapterId: 'toc', counted: false },
      ...Array.from({ length: 10 }, (_, i) => ({
        blocks: 100,
        chapterId: `body-${i + 1}`,
      })),
      { blocks: 200, chapterId: 'notes', counted: false },
      { blocks: 100, chapterId: 'refs', counted: false },
    ]);

    it('reads 50% at the start of the sixth of ten body chapters', () => {
      expect(percentAt(realistic, 'body-6', 1)).toBe(50);
    });

    it('reads 45% halfway through the fifth body chapter', () => {
      expect(percentAt(realistic, 'body-5', 50)).toBe(45);
    });

    it('reads 85% with a chapter and a half left', () => {
      expect(percentAt(realistic, 'body-9', 50)).toBe(85);
    });

    it('reads 90% at the start of the final body chapter', () => {
      expect(percentAt(realistic, 'body-10', 1)).toBe(90);
    });

    // The same positions under the old whole-book maths, for contrast: every
    // number was dragged down by the 325 blocks nobody reads.
    it('improves on the whole-book maths it replaces', () => {
      const wholeBook = buildIndex(
        [
          { blocks: 15, chapterId: 'front' },
          { blocks: 10, chapterId: 'toc' },
          ...Array.from({ length: 10 }, (_, i) => ({
            blocks: 100,
            chapterId: `body-${i + 1}`,
          })),
          { blocks: 200, chapterId: 'notes' },
          { blocks: 100, chapterId: 'refs' },
        ],
        1,
      );

      // 875 of 1325 blocks, versus 850 of the 1000 that are actually read.
      expect(percentAt(wholeBook, 'body-9', 50)).toBe(66);
      expect(percentAt(realistic, 'body-9', 50)).toBe(85);
    });

    it('advances monotonically across an uncounted chapter', () => {
      const withDivider = buildIndex([
        { blocks: 100, chapterId: 'body-1' },
        { blocks: 2, chapterId: 'divider', counted: false },
        { blocks: 100, chapterId: 'body-2' },
      ]);

      const readings = [
        percentAt(withDivider, 'body-1', 100),
        percentAt(withDivider, 'divider', 1),
        percentAt(withDivider, 'body-2', 1),
        percentAt(withDivider, 'body-2', 100),
      ];

      expect(readings).toEqual([50, 50, 51, 100]);
    });
  });

  // If the stored-index parser dropped `counted`, every chapter would count
  // against a body-only denominator and progress would silently overshoot.
  it('survives the round trip through the stored index parser', () => {
    const stored = parseStoredReadingProgressIndex(
      JSON.parse(JSON.stringify(novel)) as unknown,
    );

    expect(stored).not.toBeNull();
    expect(stored?.bodyBlocks).toBe(200);
    expect(stored?.chapters.map((c) => c.counted)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
    expect(percentAt(stored as ReadingProgressIndex, 'body-1', 100)).toBe(50);
  });

  it('rejects a locator whose chapter is not in the index', () => {
    expect(() => percentAt(novel, 'ghost', 1)).toThrow();
  });

  it('rejects a locator whose block is not in its chapter', () => {
    expect(() => percentAt(novel, 'body-1', 999)).toThrow();
  });
});
