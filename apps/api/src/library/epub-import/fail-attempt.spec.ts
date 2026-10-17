import type { PrismaService } from '../../prisma/prisma.service';
import { requireEpubClaim } from './claim-authority';
import { jobTransaction } from '../pdf-import/jobs/transaction';
import { failEpubAttempt } from './fail-attempt';
import { InvalidImportedEpub, EpubLeaseExpired } from './errors';
jest.mock('./claim-authority');
jest.mock('../pdf-import/jobs/transaction');
const claim = {
  runId: 'run',
  ownerId: 'owner',
  libraryItemId: 'item',
  fence: 1,
  token: 'secret',
};
const tx = {
  bookProcessingRun: {
    update: jest.fn((input: unknown) => Promise.resolve(input)),
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(jobTransaction)
    .mockImplementation((_db, work) => work(tx as never));
  jest.mocked(requireEpubClaim).mockResolvedValue({
    run: { id: 'run', attemptCount: 1, activeDeadlineAt: new Date(60000) },
    now: new Date(0),
  } as never);
  tx.bookProcessingRun.update.mockResolvedValue({});
});
it('retains ordinary retry semantics for a caught supervisor expiry and terminal semantics for invalid content', async () => {
  expect(
    await failEpubAttempt({} as PrismaService, claim, new EpubLeaseExpired()),
  ).toBe('PENDING');
  const write = tx.bookProcessingRun.update.mock.calls.at(-1)?.[0] as {
    data: unknown;
  };
  expect(write.data).toMatchObject({
    status: 'PENDING',
    leaseTokenHash: null,
    leaseExpiresAt: null,
  });
  expect(
    await failEpubAttempt(
      {} as PrismaService,
      claim,
      new InvalidImportedEpub(),
    ),
  ).toBe('FAILED');
});
it('distinguishes verified lost authority from an unavailable failure settlement', async () => {
  jest
    .mocked(requireEpubClaim)
    .mockRejectedValueOnce(new Error('EPUB_IMPORT_AUTHORITY_INVALID'));
  expect(
    await failEpubAttempt(
      {} as PrismaService,
      claim,
      new Error('worker failure'),
    ),
  ).toBe('AUTHORITY_LOST');
  expect(tx.bookProcessingRun.update).not.toHaveBeenCalled();
  tx.bookProcessingRun.update.mockRejectedValueOnce(
    new Error('database unavailable'),
  );
  expect(
    await failEpubAttempt(
      {} as PrismaService,
      claim,
      new Error('worker failure'),
    ),
  ).toBe('SETTLEMENT_UNAVAILABLE');
});
