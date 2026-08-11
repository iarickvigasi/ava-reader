import { normalizeChapterTitle, UNTITLED } from './normalize-title';

describe('normalizeChapterTitle', () => {
  it('keeps a real title', () => {
    expect(
      normalizeChapterTitle({
        label: 'Bibliography',
        spineIndex: 40,
        title: 'Bibliography',
      }),
    ).toBe('Bibliography');
  });

  // The fabricated `Chapter <spineIndex + 1>` label is the whole reason this
  // function exists: a bibliography at spine index 40 arrives claiming to be
  // "Chapter 41", which a model would otherwise trust.
  it('drops a label that merely restates the spine position', () => {
    expect(
      normalizeChapterTitle({
        label: 'Chapter 41',
        spineIndex: 40,
        title: 'Chapter 41',
      }),
    ).toBe(UNTITLED);
  });

  it('keeps "Chapter 5" when it does not match the spine position', () => {
    expect(
      normalizeChapterTitle({
        label: 'Chapter 5',
        spineIndex: 11,
        title: 'Chapter 5',
      }),
    ).toBe('Chapter 5');
  });

  it.each([
    'part0008.xhtml',
    'Section 0012',
    'index_split_004.html',
    '0012',
    '  ',
  ])('treats %p as machine-generated', (title) => {
    expect(normalizeChapterTitle({ label: null, spineIndex: 3, title })).toBe(
      UNTITLED,
    );
  });

  it('falls back to the label when the title is junk', () => {
    expect(
      normalizeChapterTitle({
        label: 'Notes',
        spineIndex: 3,
        title: 'part0008.xhtml',
      }),
    ).toBe('Notes');
  });

  it('returns UNTITLED when nothing usable is present', () => {
    expect(
      normalizeChapterTitle({ label: null, spineIndex: 0, title: null }),
    ).toBe(UNTITLED);
  });

  it('truncates an overlong title', () => {
    const title = 'A'.repeat(120);
    const result = normalizeChapterTitle({ label: null, spineIndex: 0, title });

    expect(result.length).toBeLessThanOrEqual(81);
    expect(result.endsWith('…')).toBe(true);
  });
});
