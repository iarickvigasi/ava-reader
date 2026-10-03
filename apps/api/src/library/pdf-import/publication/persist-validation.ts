import {
  requireValidationRun,
  type ValidationAuthority,
} from './validation-authority';
import type { Prisma, PdfArtifact } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { loadPublicationCandidate } from './load-candidate';
import { jobTransaction } from '../jobs/transaction';
import { candidateAuthority } from './candidate-authority';
import { PdfPublicationError } from './errors';
export async function persistValidation(
  prisma: PrismaService,
  candidate: Awaited<ReturnType<typeof loadPublicationCandidate>>,
  data: Prisma.PdfCandidateValidationUncheckedCreateInput,
  artifacts: PdfArtifact[],
  validationAuthority?: ValidationAuthority,
) {
  return jobTransaction(prisma, async (tx) => {
    if (validationAuthority)
      await requireValidationRun(tx, validationAuthority);
    const fresh = await candidateAuthority(tx, candidate.op.id);
    if (
      fresh.attempt.id !== candidate.attempt.id ||
      fresh.attempt.resultSha256 !== candidate.attempt.resultSha256
    )
      throw new PdfPublicationError('PDF_VALIDATION_STALE');
    const prior = await tx.pdfCandidateValidation.findUnique({
      where: {
        attemptId_validatorFingerprint: {
          attemptId: candidate.attempt.id,
          validatorFingerprint: data.validatorFingerprint,
        },
      },
    });
    if (prior) {
      if (validationAuthority) {
        await requireValidationRun(tx, validationAuthority);
        await tx.pdfValidationRun.update({
          where: { operationId: candidate.op.id },
          data: { state: 'VALIDATED', leaseExpiresAt: null, tokenHash: null },
        });
      }
      return prior;
    }
    for (const a of artifacts) {
      const pin = await tx.pdfArtifact.updateMany({
        where: {
          id: a.id,
          ownerId: candidate.op.ownerId,
          retention: 'STAGING',
          operationId: null,
          checksum: a.checksum,
          expiresAt: { gt: new Date() },
        },
        data: {
          operationId: candidate.op.id,
          retention: 'OPERATION',
          expiresAt: null,
        },
      });
      if (pin.count !== 1)
        throw new PdfPublicationError('PDF_PUBLICATION_ARTIFACT_INVALID');
    }
    const result = await tx.pdfCandidateValidation.create({ data });
    if (validationAuthority) {
      await requireValidationRun(tx, validationAuthority);
      await tx.pdfValidationRun.update({
        where: { operationId: candidate.op.id },
        data: { state: 'VALIDATED', leaseExpiresAt: null, tokenHash: null },
      });
    }
    return result;
  });
}
