import { epubLease, heartbeatCanonicalEpub } from './lease';
import { requireEpubClaim } from './claim-authority';
import type { PrismaService } from '../../prisma/prisma.service';
import { jobTransaction } from '../pdf-import/jobs/transaction';
jest.mock('./claim-authority');
jest.mock('../pdf-import/jobs/transaction');
const claim = {
  runId: 'run',
  ownerId: 'owner',
  libraryItemId: 'item',
  fence: 1,
  token: 'secret',
};
const tx = { bookProcessingRun: { update: jest.fn().mockResolvedValue({}) } };
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest
    .mocked(jobTransaction)
    .mockImplementation((_db, work) => work(tx as never));
});
afterEach(() => jest.useRealTimers());
it('does not invent initial time beyond the confirmed database receipt', async () => {
  const guard = epubLease({} as PrismaService, claim, 75);
  expect(guard.remainingMs()).toBeLessThanOrEqual(75);
  await jest.advanceTimersByTimeAsync(100);
  expect(guard.signal.aborted).toBe(true);
  expect(guard.remainingMs()).toBe(0);
  await guard.dispose();
});
it('fresh pre-launch confirmation refuses expired authority', async () => {
  jest.mocked(requireEpubClaim).mockRejectedValue(new Error('expired'));
  const guard = epubLease({} as PrismaService, claim, 30000);
  await expect(guard.confirm()).rejects.toThrow(
    'EPUB_IMPORT_AUTHORITY_INVALID',
  );
  expect(guard.signal.aborted).toBe(true);
  await guard.dispose();
});
it('rechecks database authority after the heartbeat write', async () => {
  jest
    .mocked(requireEpubClaim)
    .mockResolvedValueOnce({
      run: { id: 'run', activeDeadlineAt: new Date(50000) },
      now: new Date(1000),
    } as never)
    .mockRejectedValueOnce(new Error('lease crossed during transaction'));
  await expect(
    heartbeatCanonicalEpub({} as PrismaService, claim),
  ).rejects.toThrow('lease crossed');
  expect(tx.bookProcessingRun.update).toHaveBeenCalledTimes(1);
  expect(requireEpubClaim).toHaveBeenCalledTimes(2);
});
