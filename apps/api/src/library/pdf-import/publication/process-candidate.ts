import type { PrismaService } from '../../../prisma/prisma.service';
import type { WorkerCredential } from '../jobs/types';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import type { PdfRuntimeConfig } from '../../../pdf-conversion/runtime/runtime-config';
import {
  leaseGuard,
  underLease,
} from '../../../pdf-conversion/runtime/lease-guard';
import { reservePdfValidation } from './reserve-validation';
import { heartbeatPdfValidation } from './heartbeat-validation';
import { validatePdfCandidate } from './validate-candidate';
import { recordValidationFailure } from './record-validation-failure';
import { publicationFailureKind } from './classify-error';
import { tryPublication } from './try-publication';
import { startConversionWork } from '../reports/work-timing';
export async function processCandidate(
  prisma: PrismaService,
  credential: WorkerCredential,
  settings: {
    runtime: PdfRuntimeConfig;
    semantic: SemanticValidator;
    qualificationId?: string;
    signal?: AbortSignal;
  },
  excludedOperationIds: string[] = [],
) {
  const started = performance.now();
  const reserved = await reservePdfValidation(
    prisma,
    credential,
    settings.runtime.image.slice(7),
    excludedOperationIds,
  );
  if (reserved.kind === 'idle' || reserved.kind === 'failed') return reserved;
  let validationId =
    reserved.kind === 'publish' ? reserved.validationId : undefined;
  if (reserved.kind === 'validate') {
    const finishWork = startConversionWork();
    const guard = leaseGuard(
      reserved,
      performance.now() - started,
      () => heartbeatPdfValidation(prisma, reserved.authority),
      settings.signal,
    );
    try {
      const v = await underLease(
        () =>
          validatePdfCandidate(prisma, reserved.operationId, {
            ...settings,
            signal: guard.signal,
            validationAuthority: reserved.authority,
            leaseRemainingMs: guard.remainingMs,
          }),
        guard.signal,
      );
      validationId = v.id;
    } catch (error) {
      if (guard.signal.aborted || publicationFailureKind(error) === 'authority')
        return { kind: 'authority_lost' as const };
      return recordValidationFailure(
        prisma,
        reserved.authority,
        error,
        finishWork(),
      );
    } finally {
      guard.dispose();
    }
  }
  return tryPublication(
    prisma,
    reserved.operationId,
    validationId!,
    settings.qualificationId,
    settings.semantic,
    credential,
  );
}
