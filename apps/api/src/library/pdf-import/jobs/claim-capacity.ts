import type { Tx } from './types';
import type { JobPolicy } from './policy';
export async function hasClaimCapacity(
  tx: Tx,
  policy: JobPolicy,
  ownerId: string,
  principalId: string,
  now: Date,
) {
  const where = {
    status: 'RUNNING' as const,
    leaseExpiresAt: { gt: now },
    job: { state: 'RUNNING' as const, operation: { deletedAt: null } },
  };
  const validation = {
    state: 'RUNNING',
    leaseExpiresAt: { gt: now },
    operation: { deletedAt: null, status: 'WAITING' as const },
  };
  const canonical = {
    pipeline: 'normalize-canonical-epub-v1',
    status: 'PROCESSING' as const,
    leaseExpiresAt: { gt: now },
  };
  const canonicalGlobal = await tx.bookProcessingRun.count({
    where: canonical,
  });
  const global =
    (await tx.pdfJobAttempt.count({ where })) +
    (await tx.pdfValidationRun.count({ where: validation })) +
    canonicalGlobal;
  if (global >= policy.globalConcurrency) return false;
  const owner = await tx.pdfJobAttempt.count({
    where: {
      ...where,
      job: { state: 'RUNNING', operation: { ownerId, deletedAt: null } },
    },
  });
  const canonicalOwner = await tx.bookProcessingRun.count({
    where: { ...canonical, canonicalOwnerId: ownerId },
  });
  const ownerValidation = await tx.pdfValidationRun.count({
    where: { ...validation, operation: { ...validation.operation, ownerId } },
  });
  const principalValidation = await tx.pdfValidationRun.count({
    where: { ...validation, principalId },
  });
  const principal = await tx.pdfJobAttempt.count({
    where: { ...where, principalId },
  });
  return (
    owner + ownerValidation + canonicalOwner < policy.ownerConcurrency &&
    principal + principalValidation < policy.principalConcurrency
  );
}
