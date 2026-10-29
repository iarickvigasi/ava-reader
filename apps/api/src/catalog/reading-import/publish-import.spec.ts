import { publishImport } from './publish-import';
import { loadImport } from './load-import';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import type { PrismaService } from '../../prisma/prisma.service';

jest.mock('./load-import');
jest.mock('../../reader/package/load-reader-package');
const updateMany = jest.fn();
const db = { catalogEntry: { updateMany } } as unknown as PrismaService;
const state = {
  entry: { id: 'entry' },
  source: { id: 'source' },
  output: { id: 'output', blobId: 'blob' },
  receipt: { status: 'PROCESSED' },
};
beforeEach(() => {
  jest.resetAllMocks();
});
it('does not restore a withdrawn copy without valid processed public bytes', async () => {
  jest.mocked(loadImport).mockResolvedValue({
    ...state,
    receipt: { status: 'WITHDRAWN' },
  } as Awaited<ReturnType<typeof loadImport>>);
  await expect(publishImport(db, 'edition', 'checksum')).rejects.toThrow(
    'not completed',
  );
  expect(updateMany).not.toHaveBeenCalled();
});
it('leaves an unprocessed or poor-quality copy unpublished', async () => {
  jest
    .mocked(loadImport)
    .mockResolvedValue({ ...state, receipt: { status: 'PENDING' } } as Awaited<
      ReturnType<typeof loadImport>
    >);
  await expect(publishImport(db, 'edition', 'checksum')).rejects.toThrow(
    'not completed',
  );
  jest
    .mocked(loadImport)
    .mockResolvedValue(state as Awaited<ReturnType<typeof loadImport>>);
  jest.mocked(loadReaderPackage).mockResolvedValue({
    manifest: { sourceChecksum: 'checksum' },
    chapters: [],
    toc: [],
  } as never);
  await expect(publishImport(db, 'edition', 'checksum')).rejects.toThrow(
    'quality gate',
  );
  expect(updateMany).not.toHaveBeenCalled();
});
