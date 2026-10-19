import type { PrismaService } from '../../prisma/prisma.service';
import { claimCanonicalEpub } from './claim';
import { recordEpubEvent } from './diagnostics';
import { requireEpubClaim } from './claim-authority';
import {
  jobTransaction,
  databaseNow,
  lockLibraryItem,
} from '../pdf-import/jobs/transaction';
import { hasClaimCapacity } from '../pdf-import/jobs/claim-capacity';
jest.mock('./diagnostics');
jest.mock('./claim-authority');
jest.mock('../pdf-import/jobs/transaction');
jest.mock('../pdf-import/jobs/claim-capacity');
it('finishes deferred predecessor diagnostics before it can consume the later book’s first lease', async () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const runs = [3, 0].map((attemptCount, n) => ({
    id: `run-${n}`,
    bookId: `book-${n}`,
    canonicalOwnerId: 'owner',
    canonicalLibraryItemId: `item-${n}`,
    status: 'PENDING',
    attemptCount,
    attemptFence: attemptCount,
    leaseTokenHash: null as string | null,
    leaseExpiresAt: null as Date | null,
    activeDeadlineAt: null as Date | null,
    createdAt: now,
  }));
  const tx = {
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
    bookProcessingRun: {
      findMany: jest.fn(() =>
        Promise.resolve(
          runs.filter((r) => r.status === 'PENDING').map((r) => ({ ...r })),
        ),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = runs.find((r) => r.id === where.id)!;
          const increment = data.attemptCount as
            | { increment: number }
            | undefined;
          Object.assign(row, data, {
            attemptCount: increment
              ? row.attemptCount + increment.increment
              : row.attemptCount,
          });
          return Promise.resolve(row);
        },
      ),
    },
  };
  jest
    .mocked(jobTransaction)
    .mockImplementation((_db, work) => work(tx as never));
  jest.mocked(databaseNow).mockResolvedValue(now);
  jest.mocked(lockLibraryItem).mockResolvedValue(undefined);
  jest.mocked(hasClaimCapacity).mockResolvedValue(true);
  const confirmedClaim = jest.mocked(requireEpubClaim);
  confirmedClaim.mockImplementation((_tx, claim) =>
    Promise.resolve({
      run: runs.find((r) => r.id === claim.runId)!,
      now,
    } as never),
  );
  let release: (() => void) | undefined;
  jest.mocked(recordEpubEvent).mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        release = () => resolve(true);
      }),
  );
  const first = claimCanonicalEpub({} as PrismaService);
  while (!release) await Promise.resolve();
  expect(runs[0].status).toBe('FAILED');
  expect(runs[1]).toMatchObject({
    status: 'PENDING',
    attemptCount: 0,
    leaseTokenHash: null,
    leaseExpiresAt: null,
  });
  expect(tx.bookProcessingRun.update).toHaveBeenCalledTimes(1);
  release();
  expect(await first).toBeNull();
  jest.mocked(recordEpubEvent).mockResolvedValue(true);
  const next = await claimCanonicalEpub({} as PrismaService);
  expect(next).toMatchObject({
    runId: 'run-1',
    fence: 1,
    recoveredExpiredLease: false,
  });
  expect(runs[1]).toMatchObject({
    status: 'PROCESSING',
    attemptCount: 1,
    leaseExpiresAt: new Date(now.getTime() + 30000),
  });
  expect(recordEpubEvent).toHaveBeenCalledWith(
    expect.anything(),
    'run-0',
    expect.objectContaining({ code: 'ATTEMPTS_EXHAUSTED', attemptFence: 3 }),
  );
});
