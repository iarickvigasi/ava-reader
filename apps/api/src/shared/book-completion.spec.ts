import { isBookFinished, serializeCompletionItem } from './book-completion';

const finishedAt = new Date('2026-09-14T10:00:00.000Z');

describe('book completion', () => {
  it.each([
    { date: null, progress: null, expected: false },
    { date: null, progress: 99, expected: false },
    { date: null, progress: 100, expected: true },
    { date: null, progress: 101, expected: true },
    { date: finishedAt, progress: null, expected: true },
    { date: finishedAt, progress: 0, expected: true },
    { date: finishedAt, progress: 100, expected: true },
  ])(
    'combines explicit finish date and reader progress (%j)',
    ({ date, progress, expected }) => {
      expect(
        isBookFinished({
          finishedAt: date,
          progress: progress === null ? null : { completionPercent: progress },
        }),
      ).toBe(expected);
    },
  );

  it('serializes the exact completion snapshot without changing reader progress', () => {
    expect(
      serializeCompletionItem({
        id: 'manual',
        finishedAt,
        progress: { completionPercent: 37 },
      }),
    ).toEqual({
      libraryItemId: 'manual',
      finishedAt: finishedAt.toISOString(),
      completionPercent: 37,
    });
    expect(
      serializeCompletionItem({ id: 'new', finishedAt: null, progress: null }),
    ).toEqual({
      libraryItemId: 'new',
      finishedAt: null,
      completionPercent: 0,
    });
  });
});
