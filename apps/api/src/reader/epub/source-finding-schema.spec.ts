import { EpubSourceFindingError, sourceFindingSchema } from './source-finding';

const finding = {
  schema: 'ava.epub-source-finding.v1' as const,
  code: 'EPUB_UNSUPPORTED_LIST_FLOW' as const,
  source: { elementTag: 'li' as const, siblingIndex: 0, treePath: [0, 1, 0] },
};
describe('bounded EPUB source finding schema', () => {
  it.each([
    '/absolute.xhtml',
    '../outside.xhtml',
    'text/../outside.xhtml',
    'text/./inside.xhtml',
    'C:\\book.xhtml',
    'https://example.org/book.xhtml',
    'text/\u0000book.xhtml',
    'a'.repeat(2049),
  ])('rejects invalid resource identity %s', (resourcePath) => {
    expect(() =>
      new EpubSourceFindingError(finding).withResourcePath(resourcePath),
    ).toThrow();
  });
  it('requires bounded integer tree indices and rejects unknown diagnostic fields', () => {
    for (const treePath of [[], [-1], [0.5], Array(65).fill(0), [1_000_001]])
      expect(
        sourceFindingSchema.safeParse({
          ...finding,
          source: { ...finding.source, treePath },
        }).success,
      ).toBe(false);
    expect(
      sourceFindingSchema.safeParse({ ...finding, prose: 'Book text' }).success,
    ).toBe(false);
    expect(
      sourceFindingSchema.safeParse({
        ...finding,
        source: { ...finding.source, page: 7 },
      }).success,
    ).toBe(false);
    expect(
      sourceFindingSchema.safeParse({ ...finding, code: 'UNKNOWN' }).success,
    ).toBe(false);
  });
});

it('validates finding code and source tag correspondence', () => {
  expect(
    sourceFindingSchema.safeParse({
      ...finding,
      code: 'EPUB_REQUIRED_IMAGE_MISSING',
      source: { ...finding.source, elementTag: 'img' },
    }).success,
  ).toBe(true);
  for (const [code, elementTag] of [
    ['EPUB_REQUIRED_IMAGE_MISSING', 'td'],
    ['EPUB_UNSUPPORTED_TABLE_CELL', 'img'],
    ['EPUB_UNSUPPORTED_LIST_FLOW', 'img'],
  ])
    expect(
      sourceFindingSchema.safeParse({
        ...finding,
        code,
        source: { ...finding.source, elementTag },
      }).success,
    ).toBe(false);
});
