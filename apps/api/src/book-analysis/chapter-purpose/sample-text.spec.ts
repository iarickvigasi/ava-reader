import { chapter, paragraph, prose } from './chapter.fixture';
import {
  HEAD_SAMPLE_WORDS,
  MID_SAMPLE_WORDS,
  sampleChapterText,
} from './sample-text';

describe('sampleChapterText', () => {
  it('returns a short chapter whole', () => {
    const sample = sampleChapterText(
      chapter({ blocks: [paragraph(prose(20))] }),
    );

    expect(sample.split(' ')).toHaveLength(20);
    expect(sample).not.toContain('…');
  });

  it('caps a long chapter at the head and midpoint budget', () => {
    const sample = sampleChapterText(
      chapter({ blocks: [paragraph(prose(5_000))] }),
    );
    const words = sample.split(' ');

    // Head + midpoint slices plus the one-token gap marker between them.
    expect(words).toHaveLength(HEAD_SAMPLE_WORDS + MID_SAMPLE_WORDS + 1);
    expect(sample).toContain('…');
  });

  it('starts at the beginning of the chapter', () => {
    const sample = sampleChapterText(
      chapter({ blocks: [paragraph(prose(5_000))] }),
    );

    expect(sample.startsWith('word0 word1 word2')).toBe(true);
  });

  // Chapter openings are often just a heading and an epigraph, which look the
  // same for a body chapter and an appendix — the midpoint is what tells them
  // apart.
  it('also samples from the middle', () => {
    const sample = sampleChapterText(
      chapter({ blocks: [paragraph(prose(1_000))] }),
    );

    expect(sample).toContain('word500');
  });

  it('skips empty blocks and normalises whitespace', () => {
    const sample = sampleChapterText(
      chapter({
        blocks: [paragraph('   '), paragraph('one\n\n  two   three')],
      }),
    );

    expect(sample).toBe('one two three');
  });
});
