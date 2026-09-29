import { Prisma, type BookFile, type PrismaClient } from '@prisma/client';
import type { ReaderPackage } from '../../reader/reader-types';
import { savePackage } from './save-package';

it.each([1, 0])(
  'guards writes and creates a rollback reference (updated=%s)',
  async (count) => {
    const updateMany = jest.fn().mockResolvedValue({ count });
    const createBackup = jest.fn().mockResolvedValue({ id: 'backup' });
    const tx = { bookFile: { updateMany, create: createBackup } };
    const createBlob = jest.fn().mockResolvedValue({ id: 'new-blob' });
    const prisma = {
      storedBlob: { create: createBlob },
      $transaction: (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as unknown as PrismaClient;
    const file = {
      id: 'file',
      bookId: 'book',
      blobId: 'old-blob',
      updatedAt: new Date(),
      kind: 'DERIVED_READER',
      format: 'READER_PACKAGE',
      processingStatus: 'READY',
      readingProgressIndex: { version: 2, bodyBlocks: 99 },
    } as unknown as BookFile;
    const pending = savePackage(prisma, file, {} as ReaderPackage, null);
    if (!count) {
      await expect(pending).rejects.toThrow('changed concurrently');
      expect(createBackup).not.toHaveBeenCalled();
    } else {
      await expect(pending).resolves.toEqual({
        backupFileId: 'backup',
        oldBlobId: 'old-blob',
        newBlobId: 'new-blob',
      });
      expect(createBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blobId: 'old-blob',
            isPrimary: false,
            readingProgressIndex: file.readingProgressIndex,
          }) as unknown,
        }),
      );
    }
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'file',
        blobId: 'old-blob',
        updatedAt: file.updatedAt,
        isPrimary: true,
      },
      data: { blobId: 'new-blob', readingProgressIndex: Prisma.DbNull },
    });
  },
);
