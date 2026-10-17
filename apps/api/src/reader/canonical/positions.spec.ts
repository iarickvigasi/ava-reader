import { canonicalPositions, canonicalProgressMetrics } from './positions';
import { fixture } from './test-fixture';
it('resolves prose, nested list items, table cells and note bodies in source order', () => {
  const { book } = fixture();
  const index = canonicalPositions(book);
  expect(index.positions.get('list-child')?.ordinal).toBeLessThan(
    index.positions.get('list-next')!.ordinal,
  );
  expect(index.positions.get('cell-11')?.ordinal).toBeGreaterThan(
    index.positions.get('cell-00')!.ordinal,
  );
  for (const [blockId, position] of index.positions)
    expect(
      canonicalProgressMetrics(book, {
        chapterId: position.chapterId,
        blockId,
        textOffset: 0,
      }).completionPercent,
    ).toBeGreaterThan(0);
});
it.each([0, 1, 3, 4, 42])(
  'accepts an exact UTF16 boundary %s',
  (textOffset) => {
    expect(() =>
      canonicalProgressMetrics(fixture().book, {
        chapterId: 'chapter-one',
        blockId: 'body-one',
        textOffset,
      }),
    ).not.toThrow();
  },
);
it.each([2, -1, 0.5, Infinity, 10000])(
  'refuses an invalid UTF16 position %s including split emoji',
  (textOffset) => {
    expect(() =>
      canonicalProgressMetrics(fixture().book, {
        chapterId: 'chapter-one',
        blockId: 'body-one',
        textOffset,
      }),
    ).toThrow('position');
  },
);
it('refuses foreign chapter, missing block and non-text offsets', () => {
  const { book } = fixture();
  for (const [chapterId, blockId, textOffset] of [
    ['chapter-two', 'body-one', 0],
    ['chapter-one', 'missing', 0],
    ['chapter-one', 'figure-one', 1],
  ] as const)
    expect(() =>
      canonicalProgressMetrics(book, { chapterId, blockId, textOffset }),
    ).toThrow('position');
});
