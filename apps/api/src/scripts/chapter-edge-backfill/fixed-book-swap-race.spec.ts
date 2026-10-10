import type { BookFile, PrismaClient } from '@prisma/client';
import type { ReaderPackage } from '../../reader/reader-types';
import { savePackage } from '../chapter-label-backfill/save-package';

type Swap = {
  where: {
    book: { pdfImportPrivate: boolean; canonicalImportPrivate: boolean };
  };
  data: { blobId: string };
};

it.each(['pdfImportPrivate', 'canonicalImportPrivate'] as const)(
  'keeps the accepted primary when %s changes after candidate admission',
  async (flag) => {
    const book = { pdfImportPrivate: false, canonicalImportPrivate: false };
    const primary = { blobId: 'accepted-reader' };
    const createBackup = jest.fn();
    const updateMany = jest.fn(({ where, data }: Swap) => {
      const eligible =
        where.book.pdfImportPrivate === book.pdfImportPrivate &&
        where.book.canonicalImportPrivate === book.canonicalImportPrivate;
      if (eligible) primary.blobId = data.blobId;
      return Promise.resolve({ count: eligible ? 1 : 0 });
    });
    const tx = { bookFile: { updateMany, create: createBackup } };
    const createBlob = jest.fn().mockImplementation(() => {
      // The candidate was admitted before this concurrent classification change.
      book[flag] = true;
      return Promise.resolve({ id: 'staged-reader' });
    });
    const prisma = {
      storedBlob: { create: createBlob },
      $transaction: (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaClient;
    const file = {
      id: 'primary',
      bookId: 'book',
      blobId: primary.blobId,
      updatedAt: new Date('2026-10-05T00:00:00Z'),
    } as BookFile;
    await expect(
      savePackage(prisma, file, {} as ReaderPackage, null),
    ).rejects.toThrow('changed concurrently');
    expect(primary.blobId).toBe('accepted-reader');
    expect(createBackup).not.toHaveBeenCalled();
    expect(updateMany.mock.calls[0][0].where.book).toEqual({
      pdfImportPrivate: false,
      canonicalImportPrivate: false,
    });
    // Only staging occurred; the existing orphan sweeper owns this unused blob.
    expect(createBlob).toHaveBeenCalledTimes(1);
  },
);
