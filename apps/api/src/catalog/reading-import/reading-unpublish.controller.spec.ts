import { ReadingUnpublishController } from './reading-unpublish.controller';
import { loadImport } from './load-import';
import { syncPublication } from '../publication/sync-publication';
import { importFixture } from './import-fixture';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
jest.mock('./load-import');
jest.mock('../publication/sync-publication');
const assertAdmin = jest.fn();
const updateMany = jest.fn();
const db = { catalogEntry: { updateMany } } as unknown as PrismaService;
const controller = new ReadingUnpublishController(db, {
  assertAdmin,
} as unknown as UsersService);
const request = { auth: { clerkUserId: 'admin' } } as AuthenticatedRequest;
beforeEach(() => jest.resetAllMocks());
it('refuses non-admin mutation', async () => {
  assertAdmin.mockRejectedValue(new Error('Forbidden'));
  await expect(controller.unpublish(request, importFixture)).rejects.toThrow(
    'Forbidden',
  );
  expect(updateMany).not.toHaveBeenCalled();
});
it('withdraws public reading availability and queues durable synchronization without deleting metadata', async () => {
  jest.mocked(loadImport).mockResolvedValue({
    entry: { id: 'entry', importKey: 'import' },
    receipt: { status: 'WITHDRAWN' },
  } as Awaited<ReturnType<typeof loadImport>>);
  await controller.unpublish(request, importFixture);
  expect(updateMany).toHaveBeenCalledWith({
    where: {
      id: 'entry',
      importKey: 'import',
      book: { visibility: 'PUBLIC', privateOwnerId: null },
    },
    data: {
      status: 'ARCHIVED',
      importSyncPending: true,
      importSyncRevision: { increment: 1 },
    },
  });
  expect(syncPublication).toHaveBeenCalledWith(db, 'entry');
});
