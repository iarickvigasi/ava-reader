import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { loadAcceptedPdfReader } from '../../library/pdf-import/reader/load-published-reader';
import { loadImportedEpubReader } from '../../library/epub-import/load-imported-reader';
import { loadCanonicalReader } from './load';
import { fixture } from './test-fixture';
jest.mock('../../library/pdf-import/reader/load-published-reader');
jest.mock('../../library/epub-import/load-imported-reader');
const load = jest.mocked(loadAcceptedPdfReader);
const prisma = {} as PrismaService;
beforeEach(() => {
  load.mockReset();
  jest.mocked(loadImportedEpubReader).mockReset().mockResolvedValue(null);
});
it('passes owned identity and exact build/schema to the publication authority', async () => {
  const { item, accepted } = fixture();
  load.mockResolvedValue(accepted);
  expect(
    await loadCanonicalReader(prisma, item, {
      schema: 'ava-reader-3',
      build: 'b'.repeat(64),
    }),
  ).toBe(accepted);
  expect(load.mock.calls[0][1]).toEqual({
    ownerId: 'owner',
    libraryItemId: 'library',
    schema: 'ava-reader-3',
    build: 'b'.repeat(64),
  });
});
it('never downgrades an unqualified or unready PDF to the legacy parser', async () => {
  load.mockRejectedValue(new ConflictException('Upgrade required'));
  await expect(
    loadCanonicalReader(prisma, fixture().item, { schema: '', build: '' }),
  ).rejects.toBeInstanceOf(ConflictException);
});
it('masks internal artifact or process errors', async () => {
  load.mockRejectedValue(new Error('/private/secret/provider-message'));
  await expect(
    loadCanonicalReader(prisma, fixture().item, { schema: '', build: '' }),
  ).rejects.toEqual(
    new ServiceUnavailableException('Accepted reader content is unavailable.'),
  );
});
it('keeps ordinary EPUB reads independent of PDF validation configuration', async () => {
  const { item } = fixture();
  item.book.files[0].format = 'EPUB';
  load.mockResolvedValue(null);
  expect(
    await loadCanonicalReader(prisma, item, { schema: '', build: '' }),
  ).toBeNull();
  expect(load).toHaveBeenCalledTimes(1);
});

it('routes a published PDF with primary EPUB and nonprimary original PDF through accepted v3', async () => {
  const { item, accepted } = fixture();
  const original = { ...item.book.files[0], isPrimary: false };
  item.book.files = [
    original,
    { ...original, isPrimary: true, format: 'EPUB' },
  ];
  load.mockResolvedValue(accepted);
  expect(
    await loadCanonicalReader(prisma, item, {
      schema: 'ava-reader-3',
      build: 'b'.repeat(64),
    }),
  ).toBe(accepted);
  expect(load).toHaveBeenCalledTimes(1);
});
