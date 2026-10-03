import { fixtureBytes } from '../contracts/contract-fixtures';
import { parseContractJson } from '../contracts/parse-json';
import type { ContractMap } from '../contracts/types';
import { chapterCounting } from './chapter-counting';
import { prepareReaderPackage } from './prepare-reader-package';
import { resolveAddress } from './resolve-address';

const expected = parseContractJson(
  fixtureBytes('ava-reader-3'),
) as ContractMap['ava-reader-3'];
const context = {
  finalContentId: 'fixed-content',
  canonicalSha256: expected.canonical_sha256,
  sourceSha256: expected.book.source.sha256,
};
const semantic = jest.fn(() => Promise.resolve(true));

describe('canonical reader adapter', () => {
  beforeEach(() => semantic.mockClear());
  it('preserves the entire canonical graph, offsets and explicit false/zero', async () => {
    const canonical = fixtureBytes('ava-book-2');
    const { reader, conservation } = await prepareReaderPackage({
      canonical,
      context,
      semantic,
    });
    expect(reader.book).toEqual(parseContractJson(canonical));
    expect(reader.book.styles[0]).toMatchObject({ bold: false, indent_em: 0 });
    expect(reader.required_capabilities).toEqual(
      expected.required_capabilities,
    );
    expect(semantic.mock.calls).toHaveLength(2);
    expect(conservation).toMatchObject({
      canonicalToReader: 'pass',
      actualReader: 'not_run',
      epubConservation: 'not_run',
      sourceAccuracy: 'not_run',
      publicationEligible: false,
    });
    expect(
      resolveAddress(reader, {
        resourcePath: 'text/chapter-one.xhtml',
        fragment: 'call-1a',
      }),
    ).toMatchObject({
      finalContentId: 'fixed-content',
      offset: 25,
      utf16Offset: 26,
    });
    expect(() =>
      resolveAddress(reader, {
        resourcePath: 'text/chapter-two.xhtml',
        fragment: 'call-1a',
      }),
    ).toThrow('INVALID_CONTRACT');
  });
  it('refuses mismatched source and unavailable semantic acceptance', async () => {
    await expect(
      prepareReaderPackage({
        canonical: fixtureBytes('ava-book-2'),
        context: { ...context, sourceSha256: 'b'.repeat(64) },
        semantic,
      }),
    ).rejects.toThrow('INVALID_CONTRACT');
    await expect(
      prepareReaderPackage({
        canonical: fixtureBytes('ava-book-2'),
        context,
        semantic: () => Promise.resolve(false),
      }),
    ).rejects.toThrow('INVALID_CONTRACT');
  });
  it('copies identity before async work and reuses conservative counting without model calls', async () => {
    const mutable = { ...context };
    const prepared = prepareReaderPackage({
      canonical: fixtureBytes('ava-book-2'),
      context: mutable,
      semantic,
    });
    mutable.finalContentId = 'replaced';
    expect((await prepared).reader.final_content_id).toBe('fixed-content');
    const book = structuredClone(expected.book);
    book.chapters[0].role = 'frontmatter';
    expect(chapterCounting(book)).toEqual(
      book.chapters.map((c) => ({
        chapterId: c.id,
        sourceRole: c.role,
        counted: true,
      })),
    );
  });
});
