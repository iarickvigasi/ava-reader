import { syncPublication } from './sync-publication';
import { loadImport } from '../reading-import/load-import';
import { importFixture } from '../reading-import/import-fixture';
import type { PrismaService } from '../../prisma/prisma.service';

jest.mock('../reading-import/load-import');
const updateMany = jest.fn();
const row = {
  id: 'entry',
  importKey: 'key',
  importEvidence: importFixture,
  importSyncPending: true,
  importSyncRevision: 2,
};
const db = {
  catalogEntry: {
    findUniqueOrThrow: jest.fn().mockResolvedValue(row),
    updateMany,
  },
} as unknown as PrismaService;
const prior = {
  secret: process.env.READING_ASSET_SYNC_SECRET,
  base: process.env.CATALOG_API_BASE_URL,
};
beforeEach(() => {
  updateMany.mockReset();
  process.env.READING_ASSET_SYNC_SECRET =
    'test-only-secret-key-32-characters-long';
  process.env.CATALOG_API_BASE_URL = 'http://localhost:4001';
  jest
    .mocked(loadImport)
    .mockResolvedValue({ receipt: { status: 'READY' } } as Awaited<
      ReturnType<typeof loadImport>
    >);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (prior.secret === undefined) delete process.env.READING_ASSET_SYNC_SECRET;
  else process.env.READING_ASSET_SYNC_SECRET = prior.secret;
  if (prior.base === undefined) delete process.env.CATALOG_API_BASE_URL;
  else process.env.CATALOG_API_BASE_URL = prior.base;
});
it('keeps durable pending state after delivery failure', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
  await expect(syncPublication(db, 'entry')).rejects.toThrow('offline');
  expect(updateMany).not.toHaveBeenCalled();
});
it('signs the payload and only clears the delivered revision', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ entryId: 'entry', revision: 2, applied: true }),
      ),
    );
  await syncPublication(db, 'entry');
  expect(fetchMock.mock.calls[0][0]).toBeInstanceOf(URL);
  expect(fetchMock.mock.calls[0][1]?.headers).toHaveProperty(
    'x-reading-signature',
    expect.any(String),
  );
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'entry', importSyncRevision: 2 },
    data: { importSyncPending: false },
  });
});
