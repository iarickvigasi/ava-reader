import type { PrismaService } from '../../prisma/prisma.service';
import type { PdfRuntimeConfig } from '../../pdf-conversion/runtime/runtime-config';
import {
  jobTransaction,
  databaseNow,
  lockLibraryItem,
} from '../pdf-import/jobs/transaction';
import { hasClaimCapacity } from '../pdf-import/jobs/claim-capacity';
import { activateCanonicalEpub } from './activate';
import { processCanonicalEpubOnce } from './process-once';
jest.mock('../pdf-import/jobs/transaction');
jest.mock('../pdf-import/jobs/claim-capacity');
jest.mock('./activate');
const tx = {
  bookProcessingRun: { findMany: jest.fn(), update: jest.fn() },
  libraryItem: { findFirst: jest.fn() },
};
const disabled = { enabled: false } as unknown as PdfRuntimeConfig;
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(jobTransaction)
    .mockImplementation((_db, work) => work(tx as never));
  jest.mocked(databaseNow).mockResolvedValue(new Date('2026-09-29T12:00:00Z'));
  jest.mocked(lockLibraryItem).mockResolvedValue(undefined);
  jest.mocked(hasClaimCapacity).mockResolvedValue(true);
  jest.mocked(activateCanonicalEpub).mockResolvedValue(false);
  tx.libraryItem.findFirst.mockResolvedValue({ id: 'item' });
});
it('does not consume an eligible EPUB attempt when runtime configuration is disabled', async () => {
  tx.bookProcessingRun.findMany.mockResolvedValue([
    {
      id: 'run',
      bookId: 'book',
      canonicalOwnerId: 'owner',
      canonicalLibraryItemId: 'item',
      attemptCount: 0,
      attemptFence: 0,
      activeDeadlineAt: null,
    },
  ]);
  await expect(
    processCanonicalEpubOnce({} as PrismaService, disabled),
  ).rejects.toMatchObject({ code: 'DISPATCH_NOT_AUTHORIZED' });
  expect(tx.bookProcessingRun.update).not.toHaveBeenCalled();
});
it('lets ordinary EPUB processing continue when there is no eligible canonical work', async () => {
  tx.bookProcessingRun.findMany.mockResolvedValue([]);
  await expect(
    processCanonicalEpubOnce({} as PrismaService, disabled),
  ).resolves.toBe(false);
  expect(tx.bookProcessingRun.update).not.toHaveBeenCalled();
});
it('does not require a sandbox configuration merely to accept an already validated record', async () => {
  jest.mocked(activateCanonicalEpub).mockResolvedValue(true);
  await expect(
    processCanonicalEpubOnce({} as PrismaService, disabled),
  ).resolves.toBe(true);
  expect(tx.bookProcessingRun.findMany).not.toHaveBeenCalled();
});
