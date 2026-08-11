import { buildChapterSignals } from './chapter-signals';
import { chapter, heading, paragraph, plainProse } from './chapter.fixture';

function signalsFor(blocks: Parameters<typeof chapter>[0]['blocks']) {
  return buildChapterSignals({
    chapter: chapter({ blocks }),
    chapterIndex: 0,
    totalChapters: 10,
  });
}

describe('buildChapterSignals', () => {
  it('counts words and blocks', () => {
    const signals = signalsFor([
      paragraph(plainProse(30)),
      paragraph(plainProse(10)),
    ]);

    expect(signals.wordCount).toBe(40);
    expect(signals.blockCount).toBe(2);
  });

  it('reports the median block length, not the mean', () => {
    const signals = signalsFor([
      paragraph(plainProse(2)),
      paragraph(plainProse(4)),
      paragraph(plainProse(300)),
    ]);

    expect(signals.medianBlockWords).toBe(4);
  });

  // The signal that separates a bibliography from prose without reading it.
  it('scores a citation-dense chapter as digit-heavy', () => {
    const signals = signalsFor([
      paragraph('1. Ibid., p. 34. 2. Smith, op. cit., pp. 88-91.'),
    ]);

    expect(signals.digitPercent).toBeGreaterThan(5);
  });

  it('scores prose as digit-free', () => {
    const signals = signalsFor([paragraph(plainProse(50))]);

    expect(signals.digitPercent).toBe(0);
  });

  it('counts links, which give a contents page away', () => {
    const signals = signalsFor([
      paragraph('Chapter One', 'ch1.xhtml'),
      paragraph('Chapter Two', 'ch2.xhtml'),
      paragraph('Chapter Three', 'ch3.xhtml'),
    ]);

    expect(signals.linkCount).toBe(3);
  });

  it('counts headings', () => {
    expect(
      signalsFor([heading('Notes'), paragraph(plainProse(5))]).headingCount,
    ).toBe(1);
  });

  it('reports position as a percentage through the book', () => {
    const last = buildChapterSignals({
      chapter: chapter({ blocks: [paragraph(plainProse(5))] }),
      chapterIndex: 9,
      totalChapters: 10,
    });

    expect(last.positionPercent).toBe(100);
  });

  it('handles a single-chapter book without dividing by zero', () => {
    const only = buildChapterSignals({
      chapter: chapter({ blocks: [paragraph(plainProse(5))] }),
      chapterIndex: 0,
      totalChapters: 1,
    });

    expect(only.positionPercent).toBe(0);
  });

  it('reports an empty chapter as zero rather than NaN', () => {
    const signals = signalsFor([]);

    expect(signals).toMatchObject({
      digitPercent: 0,
      medianBlockWords: 0,
      wordCount: 0,
    });
  });
});
