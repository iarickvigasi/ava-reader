import type { UserRole } from '@prisma/client';
import { recordPdfReview } from './review';
import { reviewMembershipFixture } from './review-membership.fixture';

// This suite owns reviewer membership; report persistence is covered at its
// real boundary in reports tests and the PostgreSQL proof.
jest.mock('../reports/operation-event', () => ({
  recordOperationEvent: jest.fn(),
}));

const allowed: UserRole[][] = [['ADMIN'], ['ADMIN', 'DEVELOPER']];
const denied: (UserRole[] | null)[] = [[], ['DEVELOPER'], null];

describe.each(['APPROVE', 'REJECT'] as const)(
  '%s review authorization',
  (decision) => {
    it.each(allowed.map((roles) => [roles]))(
      'records a candidate decision with admin membership %j',
      async (roles) => {
        const { tx, prisma } = reviewMembershipFixture(roles);
        await expect(
          recordPdfReview(prisma, 'reviewer', 'validation', decision, [
            'layout',
          ]),
        ).resolves.toMatchObject({ reviewerKey: 'reviewer', decision });
        expect(tx.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'reviewer' },
          select: { roleMemberships: { select: { role: true } } },
        });
        expect(tx.pdfReviewDecision.create).toHaveBeenCalledTimes(1);
      },
    );

    it.each(denied.map((roles) => [roles]))(
      'refuses missing admin membership %j before reading candidate evidence',
      async (roles) => {
        const { tx, prisma } = reviewMembershipFixture(roles);
        await expect(
          recordPdfReview(prisma, 'reviewer', 'validation', decision, [
            'layout',
          ]),
        ).rejects.toMatchObject({ code: 'PDF_REVIEW_UNAUTHORIZED' });
        expect(
          tx.pdfCandidateValidation.findUniqueOrThrow,
        ).not.toHaveBeenCalled();
        expect(tx.pdfReviewDecision.findUnique).not.toHaveBeenCalled();
        expect(tx.pdfReviewDecision.create).not.toHaveBeenCalled();
      },
    );
  },
);

it('rechecks membership before returning an existing decision after revocation', async () => {
  const { tx, prisma } = reviewMembershipFixture(['ADMIN']);
  const existing = {
    reviewerKey: 'reviewer',
    decision: 'APPROVE',
    approvedFindings: ['layout'],
  };
  tx.pdfReviewDecision.findUnique.mockResolvedValue(existing as never);
  await expect(
    recordPdfReview(prisma, 'reviewer', 'validation', 'APPROVE', ['layout']),
  ).resolves.toBe(existing);
  tx.user.findUnique.mockResolvedValue({
    roleMemberships: [{ role: 'DEVELOPER' }],
  });
  tx.pdfCandidateValidation.findUniqueOrThrow.mockClear();
  tx.pdfReviewDecision.findUnique.mockClear();
  await expect(
    recordPdfReview(prisma, 'reviewer', 'validation', 'APPROVE', ['layout']),
  ).rejects.toMatchObject({ code: 'PDF_REVIEW_UNAUTHORIZED' });
  expect(tx.pdfCandidateValidation.findUniqueOrThrow).not.toHaveBeenCalled();
  expect(tx.pdfReviewDecision.findUnique).not.toHaveBeenCalled();
  expect(tx.pdfReviewDecision.create).not.toHaveBeenCalled();
});
