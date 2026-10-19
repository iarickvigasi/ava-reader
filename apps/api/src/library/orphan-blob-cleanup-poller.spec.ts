import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { productionPollerTimers } from '../book-analysis/book-analysis-poller.fixture';
import { cleanupExpiredPdfStaging } from './pdf-import/artifacts/cleanup-staging';
import { cleanupDeletedProviderPayloads } from './pdf-import/providers/cleanup-deleted-payloads';
import { OrphanBlobCleanupService } from './orphan-blob-cleanup.service';

jest.mock('./pdf-import/artifacts/cleanup-staging', () => ({
  cleanupExpiredPdfStaging: jest.fn(),
}));
jest.mock('./pdf-import/providers/cleanup-deleted-payloads', () => ({
  cleanupDeletedProviderPayloads: jest.fn(),
}));
const staging = jest.mocked(cleanupExpiredPdfStaging);
const payloads = jest.mocked(cleanupDeletedProviderPayloads);

describe('orphan cleanup scheduled failure boundary', () => {
  productionPollerTimers();
  beforeEach(() => {
    staging.mockReset();
    payloads.mockReset();
  });

  it('contains asynchronous cleanup failure with safe logging and recovers on its next sweep', async () => {
    const error = Object.assign(
      new Error('postgresql://private:secret@host/content'),
      { code: 'P1001' },
    );
    staging.mockRejectedValueOnce(error);
    const remove = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      storedBlob: { deleteMany: remove },
    } as unknown as PrismaService;
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const service = new OrphanBlobCleanupService(prisma);
    service.onModuleInit();
    try {
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(remove).not.toHaveBeenCalled();
      expect(payloads).not.toHaveBeenCalled();
      expect(log.mock.calls).toEqual([
        [
          'Orphan blob cleanup unavailable (P1001); checking again on the next sweep.',
        ],
      ]);
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(staging).toHaveBeenCalledTimes(2);
      expect(payloads).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
      service.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(staging).toHaveBeenCalledTimes(2);
    } finally {
      service.onModuleDestroy();
    }
  });
});
