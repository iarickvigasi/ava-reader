import type { PrismaService } from '../../prisma/prisma.service';
import { loadImportedEpubReader } from '../../library/epub-import/load-imported-reader';
import { loadAcceptedPdfReader } from '../../library/pdf-import/reader/load-published-reader';
import { loadCanonicalReader } from './load';
import { canonicalReaderPayload } from './payload';
import { canonicalTranslationContext } from '../../book-translations/source/canonical-context';
import { importedFixture } from './imported-fixture';
jest.mock('../../library/epub-import/load-imported-reader');
jest.mock('../../library/pdf-import/reader/load-published-reader');
const capability = { schema: 'ava-reader-3', build: 'b'.repeat(64) };
it('uses separately owned imported EPUB identity without creating PDF authority or old IDs', async () => {
  const { item, accepted } = importedFixture();
  jest.mocked(loadAcceptedPdfReader).mockResolvedValue(null);
  jest.mocked(loadImportedEpubReader).mockResolvedValue(accepted);
  expect(await loadCanonicalReader({} as PrismaService, item, capability)).toBe(
    accepted,
  );
  expect(loadImportedEpubReader).toHaveBeenCalledWith(
    expect.anything(),
    { ownerId: 'owner', libraryItemId: 'library', ...capability },
    expect.any(Function),
  );
  const payload = canonicalReaderPayload(item, accepted);
  expect(payload.book.primaryFormat).toBe('EPUB');
  const context = canonicalTranslationContext(item, accepted, {
    chapterId: 'chapter-one',
    targetLang: 'French',
    capability,
  });
  expect(context.contentRevision).toBe('imported-final');
  expect(context.canonicalAuthority).toMatchObject({
    kind: 'epub-import',
    importId: 'import',
    finalContentId: 'imported-final',
  });
  expect(context.canonicalAuthority).not.toHaveProperty('operationId');
  expect(context.canonicalAuthority).not.toHaveProperty('publicationId');
});
it('never falls through when imported EPUB qualification refuses access', async () => {
  jest.mocked(loadAcceptedPdfReader).mockResolvedValue(null);
  jest
    .mocked(loadImportedEpubReader)
    .mockRejectedValue(new Error('private-qualification-error'));
  await expect(
    loadCanonicalReader(
      {} as PrismaService,
      importedFixture().item,
      capability,
    ),
  ).rejects.toThrow('Accepted reader content is unavailable');
});
