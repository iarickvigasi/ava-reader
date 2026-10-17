import type { PrismaClient } from '@prisma/client';
import { fixture } from './package.fixture';
import { runBackfill } from './run-backfill';

it('dry-runs all users without writes, pages, and continues after bad packages', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const error = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const findMany = jest
    .fn()
    .mockResolvedValueOnce([
      { id: 'a', bookId: 'book-a', blobId: 'bad', readingProgressIndex: null },
      { id: 'b', bookId: 'book-b', blobId: 'good', readingProgressIndex: null },
    ])
    .mockResolvedValueOnce([]);
  const write = jest.fn();
  const prisma = {
    bookFile: { findMany, updateMany: write, create: write },
    storedBlob: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValueOnce({ bytes: Buffer.from('invalid') })
        .mockResolvedValueOnce({
          bytes: Buffer.from(JSON.stringify(fixture())),
        }),
      create: write,
    },
    $transaction: write,
  } as unknown as PrismaClient;
  try {
    await expect(runBackfill(prisma, false)).rejects.toThrow('1 files failed');
    expect(write).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          isPrimary: true,
          processingStatus: 'READY',
          book: {
            pdfImportPrivate: false,
            canonicalImportPrivate: false,
            libraryItems: { some: {} },
            files: {
              some: { kind: 'SOURCE', format: 'EPUB', isPrimary: true },
            },
          },
        }) as unknown,
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { gt: 'b' } }) as unknown,
      }),
    );
    expect(log).toHaveBeenLastCalledWith(
      JSON.stringify({
        summary: { scanned: 2, changed: 1, chapters: 2, failed: 1 },
        apply: false,
      }),
    );
    expect(error).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
});
