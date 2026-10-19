import type { PrismaClient } from '@prisma/client';
import { processFile } from './process-file';
import { runEdgeBackfill } from './run-backfill';

jest.mock('./process-file');
it('scans only mutable legacy EPUB readers and processes each candidate once', async () => {
  const findMany = jest
    .fn()
    .mockResolvedValueOnce([{ id: 'legacy', bookId: 'book' }])
    .mockResolvedValueOnce([]);
  jest.mocked(processFile).mockResolvedValue({ status: 'unchanged' });
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    await runEdgeBackfill(
      { bookFile: { findMany } } as unknown as PrismaClient,
      false,
      'book',
    );
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: undefined,
        bookId: 'book',
        kind: 'DERIVED_READER',
        format: 'READER_PACKAGE',
        isPrimary: true,
        processingStatus: 'READY',
        book: {
          pdfImportPrivate: false,
          canonicalImportPrivate: false,
          libraryItems: { some: {} },
          files: { some: { kind: 'SOURCE', format: 'EPUB', isPrimary: true } },
        },
      },
      orderBy: { id: 'asc' },
      take: 25,
    });
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { gt: 'legacy' } }) as unknown,
      }),
    );
    expect(processFile).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});
