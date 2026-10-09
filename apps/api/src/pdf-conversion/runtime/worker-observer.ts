import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { SafeConversionEvent } from '../../library/pdf-import/reports/event-contract';
import type { workerObservationSink } from './worker-observation-sink';
import type { SandboxInput } from './container-arguments';
import { checksumBuffer } from '../../shared/blob-utils';
import { workerBinding } from './worker-observation';
import { PdfRuntimeError } from './runtime-error';
import { SourceContentError } from '../reconstruction/source-refusal';
import { PdfProviderError } from '../../library/pdf-import/providers/errors';
import {
  startConversionWork,
  workEventDetails,
  workEventTiming,
} from '../../library/pdf-import/reports/work-timing';

export type WorkerObserver = ReturnType<typeof workerObserver>;
export function workerObserver(
  claim: ClaimedPdfJob,
  sink: ReturnType<typeof workerObservationSink>,
  signal: AbortSignal,
) {
  const job = structuredClone(claim.job);
  const attemptId = claim.authority.attemptId,
    jobId = claim.jobId;
  let sequence = 0;
  const emit = (
    kind: SafeConversionEvent['kind'],
    stage: string,
    unitId: string,
    details: SafeConversionEvent['details'],
    timing?: Pick<SafeConversionEvent, 'observedAt' | 'durationMs'>,
  ) => {
    try {
      sink.emit({
        kind,
        stage,
        severity: details.outcome === 'FAILED' ? 'WARN' : 'INFO',
        attemptId,
        attemptFence: job.attempt_fence,
        generation: job.generation,
        cancellationEpoch: job.cancellation_epoch,
        ...timing,
        ...(timing?.durationMs !== undefined
          ? { durationKind: 'OBSERVED_WALL_CLOCK' as const }
          : {}),
        details: {
          sourceSha256: job.source.sha256,
          configSha256: job.config_sha256,
          profileId: job.profile_id,
          workerFingerprint: job.worker_fingerprint,
          jobId,
          unitId,
          ...details,
        },
      });
    } catch {
      /* Optional observations cannot alter the original action. */
    }
  };
  return {
    emit,
    summary: sink.summary,
    nextUnit: (name: string) => `unit-${name}-${++sequence}`,
    binding(unitId: string, input: SandboxInput) {
      try {
        const binding = workerBinding.safeParse({
          operation_id: job.operation_id,
          job_id: jobId,
          attempt_id: attemptId,
          unit_id: unitId,
          source_sha256: job.source.sha256,
          profile_id: job.profile_id,
          config_sha256: job.config_sha256,
          worker_fingerprint: job.worker_fingerprint,
          generation: job.generation,
          attempt_fence: job.attempt_fence,
          cancellation_epoch: job.cancellation_epoch,
          request_sha256: checksumBuffer(
            input.auxiliaryBytes ?? Buffer.alloc(0),
          ),
        });
        return binding.success ? binding.data : undefined;
      } catch {
        return undefined;
      }
    },
    async track<T>(
      stage: string,
      unitId: string,
      action: () => Promise<T>,
      details: SafeConversionEvent['details'] = {},
      describe?: (result: T) => SafeConversionEvent['details'],
    ) {
      const finishWork = startConversionWork(),
        begun = finishWork();
      emit(
        'STAGE_STARTED',
        stage,
        unitId,
        {
          ...details,
          ...(begun
            ? { startedAt: begun.startedAt }
            : { timingStatus: 'UNOBSERVED' }),
        },
        begun ? { observedAt: begun.startedAt } : undefined,
      );
      try {
        const result = await action(),
          work = finishWork();
        let observed: SafeConversionEvent['details'] = {};
        try {
          observed = describe?.(result) ?? {};
        } catch {
          observed = {
            outcome: 'UNOBSERVED',
            workerObservation: { status: 'UNOBSERVED', reason: 'UNAVAILABLE' },
          };
        }
        emit(
          'STAGE_ENDED',
          stage,
          unitId,
          {
            outcome: 'COMPLETED',
            ...details,
            ...observed,
            ...workEventDetails(work),
          },
          workEventTiming(work),
        );
        return result;
      } catch (error) {
        const work = finishWork();
        const failure: SafeConversionEvent['details'] = {};
        try {
          if (
            error instanceof PdfRuntimeError ||
            error instanceof PdfProviderError ||
            error instanceof SourceContentError
          )
            failure.failureCode = error.code;
          if (error instanceof SourceContentError) {
            const diagnostic = error.diagnostic();
            if (diagnostic.source_sha256 === job.source.sha256)
              failure.sourceFindings = {
                stage: diagnostic.stage,
                complete: diagnostic.findings.length <= 2,
                findings: diagnostic.findings
                  .slice(0, 2)
                  .map((finding) => ({ kind: 'source', ...finding })),
              };
          }
        } catch {
          /* Missing failure observations remain unavailable. */
        }
        emit(
          'STAGE_ENDED',
          stage,
          unitId,
          {
            ...details,
            ...failure,
            outcome: signal.aborted ? 'ABORTED' : 'FAILED',
            workerObservation: { status: 'UNOBSERVED', reason: 'UNAVAILABLE' },
            ...workEventDetails(work),
          },
          workEventTiming(work),
        );
        throw error;
      }
    },
  };
}
