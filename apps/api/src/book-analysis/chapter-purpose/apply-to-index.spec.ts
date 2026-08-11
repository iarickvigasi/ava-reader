import type { ReadingProgressIndex } from '../../reader/reader-types';
import { applyPurposesToIndex } from './apply-to-index';
import type { ChapterPurposeAnalysis } from './chapter-purpose';

function indexWith(
  chapters: { blocks: number; chapterId: string }[],
): ReadingProgressIndex {
  return {
    chapters: chapters.map((entry) => ({
      blockIds: Array.from(
        { length: entry.blocks },
        (_, i) => `${entry.chapterId}::b${i + 1}`,
      ),
      chapterId: entry.chapterId,
      label: entry.chapterId,
      title: entry.chapterId,
    })),
    toc: [],
    totalBlocks: chapters.reduce((sum, entry) => sum + entry.blocks, 0),
    version: 1,
  };
}

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

describe('applyPurposesToIndex', () => {
  it('marks the index as v2 and totals only counted blocks', () => {
    const result = applyPurposesToIndex(
      indexWith([
        { blocks: 80, chapterId: 'body' },
        { blocks: 20, chapterId: 'notes' },
      ]),
      analysis,
    );

    expect(result.version).toBe(2);
    expect(result.bodyBlocks).toBe(80);
    expect(result.totalBlocks).toBe(100);
  });

  it('flags each chapter with its counting outcome', () => {
    const result = applyPurposesToIndex(
      indexWith([
        { blocks: 80, chapterId: 'body' },
        { blocks: 20, chapterId: 'notes' },
      ]),
      analysis,
    );

    expect(result.chapters.map((c) => c.counted)).toEqual([true, false]);
  });

  // Never subtract blocks on the strength of missing information.
  it('counts a chapter the analysis never mentioned', () => {
    const result = applyPurposesToIndex(
      indexWith([
        { blocks: 80, chapterId: 'body' },
        { blocks: 20, chapterId: 'notes' },
        { blocks: 10, chapterId: 'surprise' },
      ]),
      analysis,
    );

    expect(result.chapters[2].counted).toBe(true);
    expect(result.bodyBlocks).toBe(90);
  });

  it('preserves the table of contents and block ids', () => {
    const source = indexWith([{ blocks: 3, chapterId: 'body' }]);
    const result = applyPurposesToIndex(source, analysis);

    expect(result.chapters[0].blockIds).toEqual(source.chapters[0].blockIds);
    expect(result.toc).toBe(source.toc);
  });
});
