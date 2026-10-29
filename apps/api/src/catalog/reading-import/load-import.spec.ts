import { loadImport } from './load-import';
import type { PrismaService } from '../../prisma/prisma.service';
import { importFixture } from './import-fixture';

function entry() {
  return {
    id: 'entry',
    importEvidence: importFixture,
    status: 'DRAFT',
    importSyncPending: false,
    importPublishedAt: null as Date | null,
    book: {
      coverBlob: { catalogBlobId: 'catalog-cover' },
      visibility: 'PUBLIC',
      language: 'en',
      privateOwnerId: null as string | null,
      files: [
        {
          id: 'source',
          kind: 'SOURCE',
          format: 'EPUB',
          blob: { checksum: importFixture.checksum },
        },
        {
          id: 'output',
          kind: 'DERIVED_READER',
          processingStatus: 'READY',
          blob: { checksum: 'derived' },
        },
      ],
      processingRuns: [
        {
          status: 'READY',
          sourceFileId: 'source',
          outputFileId: 'output',
          errorMessage: null,
        },
      ],
    },
  };
}
it('advertises READY only for a published, processed public copy of these bytes', async () => {
  const value = entry();
  const db = {
    catalogEntry: { findUnique: jest.fn().mockImplementation(() => value) },
  } as unknown as PrismaService;
  const status = async () =>
    (await loadImport(db, importFixture.editionId, importFixture.checksum))
      .receipt.status;
  expect(await status()).toBe('PROCESSED');
  value.status = 'PUBLISHED';
  value.importPublishedAt = new Date();
  expect(await status()).toBe('READY');
  expect(
    (await loadImport(db, importFixture.editionId, importFixture.checksum))
      .receipt.syncPending,
  ).toBe(false);
  value.importSyncPending = true;
  expect(
    (await loadImport(db, importFixture.editionId, importFixture.checksum))
      .receipt.syncPending,
  ).toBe(true);
  value.book.processingRuns[0].sourceFileId = 'different-source';
  expect(await status()).toBe('PENDING');
  value.book.processingRuns[0].sourceFileId = 'source';
  value.status = 'DRAFT';
  expect(await status()).toBe('WITHDRAWN');
  value.status = 'PUBLISHED';
  value.book.visibility = 'PRIVATE';
  expect(await status()).toBe('WITHDRAWN');
  value.book.visibility = 'PUBLIC';
  value.book.privateOwnerId = 'private-owner';
  expect(await status()).toBe('WITHDRAWN');
});

it('returns the Catalog cover reference for importer assignment', async () => {
  const db = {
    catalogEntry: { findUnique: jest.fn().mockResolvedValue(entry()) },
  } as unknown as PrismaService;
  const result = await loadImport(
    db,
    importFixture.editionId,
    importFixture.checksum,
  );
  expect(result.receipt.coverCatalogBlobId).toBe('catalog-cover');
});
