import type { PdfCandidateValidation, PdfReviewDecision } from '@prisma/client';
import { PdfPublicationError } from './errors';
export function assertReviewClearance(
  v: PdfCandidateValidation,
  review: PdfReviewDecision | null,
) {
  if (
    !['PASS', 'REVIEW'].includes(v.verdict) ||
    v.hardBlocks.length ||
    review?.decision === 'REJECT'
  )
    throw new PdfPublicationError('PDF_PUBLICATION_HARD_BLOCKED');
  if (
    v.reviewFindings.length &&
    (!review ||
      review.decision !== 'APPROVE' ||
      review.reviewerRole !== 'ADMIN' ||
      review.policyVersion !== 'ava-pdf-review-1' ||
      JSON.stringify([...review.approvedFindings].sort()) !==
        JSON.stringify([...v.reviewFindings].sort()))
  )
    throw new PdfPublicationError('PDF_PUBLICATION_REVIEW_REQUIRED');
}
