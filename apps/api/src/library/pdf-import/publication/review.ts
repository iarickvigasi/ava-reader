import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction } from '../jobs/transaction';
import { candidateAuthority } from './candidate-authority';
import { PdfPublicationError } from './errors';
import { assertValidationScope } from './validation-scope';
export function recordPdfReview(
  prisma: PrismaService,
  reviewerId: string,
  validationId: string,
  decision: 'APPROVE' | 'REJECT',
  findings: string[],
) {
  const approved = [...findings].sort();
  return jobTransaction(prisma, async (tx) => {
    const reviewer = await tx.user.findUnique({
      where: { id: reviewerId },
      select: { roleMemberships: { select: { role: true } } },
    });
    if (
      !reviewer?.roleMemberships.some(
        (membership) => membership.role === 'ADMIN',
      )
    )
      throw new PdfPublicationError('PDF_REVIEW_UNAUTHORIZED');
    const validation = await tx.pdfCandidateValidation.findUniqueOrThrow({
      where: { id: validationId },
    });
    const previous = await tx.pdfReviewDecision.findUnique({
      where: { validationId },
    });
    if (previous) {
      if (
        previous.reviewerKey !== reviewerId ||
        previous.decision !== decision ||
        JSON.stringify(previous.approvedFindings) !== JSON.stringify(approved)
      )
        throw new PdfPublicationError('PDF_REVIEW_CONFLICT');
      return previous;
    }
    assertValidationScope(
      validation,
      await candidateAuthority(tx, validation.operationId),
    );
    if (
      !['APPROVE', 'REJECT'].includes(decision) ||
      validation.verdict === 'BLOCKED' ||
      validation.hardBlocks.length ||
      (decision === 'APPROVE' &&
        JSON.stringify(approved) !==
          JSON.stringify([...validation.reviewFindings].sort()))
    )
      throw new PdfPublicationError('PDF_REVIEW_HARD_BLOCKED');
    return tx.pdfReviewDecision.create({
      data: {
        validationId,
        reviewerKey: reviewerId,
        reviewerRole: 'ADMIN',
        decision,
        approvedFindings: approved,
        policyVersion: 'ava-pdf-review-1',
      },
    });
  });
}
