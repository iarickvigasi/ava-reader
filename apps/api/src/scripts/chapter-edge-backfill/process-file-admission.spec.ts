import type { BookFile, PrismaClient } from '@prisma/client';
import { processFile } from './process-file';
import { readSourceSections } from '../../reader/epub/edge-grouping/read-source-sections';
import { savePackage } from '../chapter-label-backfill/save-package';

jest.mock('../../reader/epub/edge-grouping/read-source-sections');
jest.mock('../chapter-label-backfill/save-package');
beforeEach(() => jest.clearAllMocks());
it.each([
  { pdfImportPrivate: true, canonicalImportPrivate: false },
  { pdfImportPrivate: false, canonicalImportPrivate: true },
  { pdfImportPrivate: true, canonicalImportPrivate: true },
])(
  'refuses fixed book %j before source/package reads or writes',
  async (book) => {
    const stored = jest.fn(),
      source = jest.fn();
    const findBook = jest.fn().mockResolvedValue(book);
    const prisma = {
      book: { findUniqueOrThrow: findBook },
      storedBlob: { findUniqueOrThrow: stored },
      bookFile: { findMany: source },
    } as unknown as PrismaClient;
    const file = {
      id: 'accepted',
      bookId: 'fixed',
      blobId: 'fixed-reader',
    } as BookFile;
    expect(await processFile(prisma, file, true)).toEqual({
      status: 'blocked',
      blockers: ['Finished PDF/canonical books are excluded from regrouping'],
    });
    expect(findBook).toHaveBeenCalledWith({
      where: { id: 'fixed' },
      select: { pdfImportPrivate: true, canonicalImportPrivate: true },
    });
    expect(stored).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
    expect(readSourceSections).not.toHaveBeenCalled();
    expect(savePackage).not.toHaveBeenCalled();
  },
);
