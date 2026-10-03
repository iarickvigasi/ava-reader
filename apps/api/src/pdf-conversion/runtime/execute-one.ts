import type { PrismaService } from '../../prisma/prisma.service';
import {
  claimPdfJob,
  heartbeatPdfJob,
  JobAuthorityError,
  type WorkerCredential,
} from '../../library/pdf-import/jobs';
import type { SemanticValidator } from '../contracts/types';
import { runClaimedContent } from './run-claimed-content';
import { settleExecutionFailure } from './settle-execution-failure';
import { completeStagedPdfJob } from '../../library/pdf-import/jobs/complete-staged';
import { leaseGuard, underLease } from './lease-guard';
import { validateRuntimeConfig, type PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError } from './runtime-error';

export async function executeOne(
  prisma: PrismaService,
  credential: WorkerCredential,
  settings: PdfRuntimeConfig,
  semantic: SemanticValidator,
  signal?: AbortSignal,
) {
  const config = validateRuntimeConfig(settings);
  // A legacy canary must not silently run a normal reconstruction job.
  if (config.fault) throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const started = performance.now();
  const claim = await claimPdfJob(prisma, { ...credential });
  if (!claim) return { status: 'idle' };
  const authority = { ...claim.authority };
  const scope = {
    operationId: claim.job.operation_id,
    attemptFence: claim.job.attempt_fence,
  };
  const guard = leaseGuard(
    claim,
    performance.now() - started,
    () => heartbeatPdfJob(prisma, authority),
    signal,
  );
  try {
    const result = await runClaimedContent(
      prisma,
      claim,
      config,
      semantic,
      guard,
    );
    const saved = await underLease(
      () =>
        completeStagedPdfJob(prisma, {
          authority,
          completion: result.completion,
          stagedByPath: result.stagedByPath,
          semantic,
        }),
      guard.signal,
    );
    return {
      ...scope,
      status: saved.status,
    };
  } catch (error) {
    if (guard.signal.aborted || error instanceof JobAuthorityError)
      return { ...scope, status: 'authority_lost', lease: guard.diagnostic() };

    let saved: { status: string; code: string };
    try {
      saved = await underLease(
        () => settleExecutionFailure(prisma, authority, error),
        guard.signal,
      );
    } catch (failure) {
      if (guard.signal.aborted || failure instanceof JobAuthorityError)
        return {
          ...scope,
          status: 'authority_lost',
          lease: guard.diagnostic(),
        };
      throw new PdfRuntimeError('WORKER_CRASH');
    }
    return {
      ...scope,
      status: saved.status,
      code: saved.code,
      cleanupFailed:
        error instanceof PdfRuntimeError ? error.cleanupFailed : undefined,
      faultAcknowledgement:
        error instanceof PdfRuntimeError
          ? error.faultAcknowledgement
          : undefined,
    };
  } finally {
    guard.dispose();
  }
}
