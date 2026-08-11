import { batchChapters, MAX_CHAPTERS_PER_REQUEST } from './batch';

describe('batchChapters', () => {
  it('keeps a normal book in a single request', () => {
    const batches = batchChapters(Array.from({ length: 40 }, (_, i) => i));

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(40);
  });

  it('splits a book that exceeds the cap', () => {
    const chapters = Array.from(
      { length: MAX_CHAPTERS_PER_REQUEST * 2 + 5 },
      (_, i) => i,
    );
    const batches = batchChapters(chapters);

    expect(batches).toHaveLength(3);
    expect(batches.at(-1)).toHaveLength(5);
  });

  it('loses no chapters when splitting', () => {
    const chapters = Array.from({ length: 137 }, (_, i) => i);

    expect(batchChapters(chapters, 10).flat()).toEqual(chapters);
  });

  it('returns nothing for an empty book', () => {
    expect(batchChapters([])).toEqual([]);
  });

  it('rejects a nonsensical batch size rather than looping forever', () => {
    expect(() => batchChapters([1, 2], 0)).toThrow();
  });
});
