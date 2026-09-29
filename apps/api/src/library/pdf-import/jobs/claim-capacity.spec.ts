import type { Tx } from './types';
import { hasClaimCapacity } from './claim-capacity';
import { DEFAULT_JOB_POLICY } from './policy';
it.each([
  [2, 0, false],
  [1, 1, false],
  [1, 0, true],
])(
  'counts %s canonical workers globally and %s for this owner',
  async (global, owner, allowed) => {
    const canonical = jest
      .fn()
      .mockResolvedValueOnce(global)
      .mockResolvedValueOnce(owner);
    const tx = {
      bookProcessingRun: { count: canonical },
      pdfJobAttempt: { count: jest.fn().mockResolvedValue(0) },
      pdfValidationRun: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as Tx;
    const now = new Date();
    const canonicalWhere = {
      pipeline: 'normalize-canonical-epub-v1',
      status: 'PROCESSING',
      leaseExpiresAt: { gt: now },
    };
    expect(
      await hasClaimCapacity(tx, DEFAULT_JOB_POLICY, 'owner', 'principal', now),
    ).toBe(allowed);
    expect(canonical).toHaveBeenNthCalledWith(1, {
      where: canonicalWhere,
    });
    if (global < 2)
      expect(canonical).toHaveBeenNthCalledWith(2, {
        where: { ...canonicalWhere, canonicalOwnerId: 'owner' },
      });
  },
);
