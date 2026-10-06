import type { BookFile, PrismaClient } from '@prisma/client';
import { checksumBuffer } from '../../shared/blob-utils';
import { savePackage } from '../chapter-label-backfill/save-package';
import { setup } from './edge.fixture';
import { readSourceSections } from '../../reader/epub/edge-grouping/read-source-sections';
import { checkReferences } from './check-references';
import { processFile } from './process-file';

jest.mock('../../reader/epub/edge-grouping/read-source-sections');
jest.mock('./check-references');
jest.mock('../chapter-label-backfill/save-package');

function harness() {
  const { pkg, source } = setup([
    'front',
    'front',
    'contents',
    'unknown',
    'footnote',
    'footnote',
  ]);
  const epub = Buffer.from('source fixture');
  pkg.manifest.sourceChecksum = checksumBuffer(epub);
  jest.mocked(readSourceSections).mockResolvedValue(source);
  jest.mocked(checkReferences).mockResolvedValue([]);
  jest.mocked(savePackage).mockResolvedValue({
    backupFileId: 'backup',
    oldBlobId: 'old',
    newBlobId: 'new',
  });
  const prisma = {
    bookFile: { findMany: jest.fn().mockResolvedValue([{ blobId: 'epub' }]) },
    storedBlob: {
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve({
            bytes:
              where.id === 'epub' ? epub : Buffer.from(JSON.stringify(pkg)),
          }),
        ),
    },
  } as unknown as PrismaClient;
  const file = {
    id: 'file',
    blobId: 'old',
    bookId: 'book',
    readingProgressIndex: null,
  } as BookFile;
  return { prisma, file, pkg };
}

beforeEach(() => jest.clearAllMocks());
it('previews without writes and reports groups and evidence', async () => {
  const { prisma, file } = harness();
  const result = await processFile(prisma, file, false);
  expect(result).toMatchObject({ status: 'dry-run', before: 6, after: 4 });
  expect(savePackage).not.toHaveBeenCalled();
});
it('saves only after reference checks and returns rollback IDs', async () => {
  const { prisma, file } = harness();
  expect(await processFile(prisma, file, true)).toMatchObject({
    status: 'applied',
    backupFileId: 'backup',
  });
  expect(savePackage).toHaveBeenCalledTimes(1);
  expect(checkReferences).toHaveBeenCalledWith(
    prisma,
    'book',
    new Set(['c1', 'c5']),
  );
});
it('refuses an apply with affected user data', async () => {
  const { prisma, file } = harness();
  jest.mocked(checkReferences).mockResolvedValue(['Saved position']);
  expect(await processFile(prisma, file, true)).toMatchObject({
    status: 'blocked',
    blockers: ['Saved position'],
  });
  expect(savePackage).not.toHaveBeenCalled();
});
it('rejects mismatched source bytes before building a plan', async () => {
  const { prisma, file, pkg } = harness();
  pkg.manifest.sourceChecksum = 'different';
  await expect(processFile(prisma, file, true)).rejects.toThrow('checksum');
  expect(savePackage).not.toHaveBeenCalled();
});
