import type { PrismaService } from '../../prisma/prisma.service';
import type {
  AttemptAuthority,
  JobProgress,
} from '../../library/pdf-import/jobs';
import { dispatchPdfProvider } from '../../library/pdf-import/providers/dispatch';
import type { ProviderTransport } from '../../library/pdf-import/providers/types';
import { stagePdfStreamArtifact } from '../../library/pdf-import/jobs/stage-stream-artifact';
import { runSandbox } from '../runtime/run-sandbox';
import type { PdfRuntimeConfig } from '../runtime/runtime-config';
import type { CoordinatorDependencies } from './coordinator-types';
import type { WorkerObserver } from '../runtime/worker-observer';

// A dormant integration seam. Route/source/budget authority is checked by the ledger on every call.
export function workerDependencies(
  prisma: PrismaService,
  authority: AttemptAuthority,
  runtime: PdfRuntimeConfig,
  signal: AbortSignal,
  progress: (progress: JobProgress) => Promise<void>,
  testTransport?: ProviderTransport,
  observer?: WorkerObserver,
): CoordinatorDependencies {
  return {
    observer,
    sandbox: (input) => {
      if (!observer) return runSandbox(input, runtime);
      const unit = observer.nextUnit('sandbox');
      return observer.track(
        'WORKER_COMMAND',
        unit,
        () =>
          runSandbox(
            { ...input, observationBinding: observer.binding(unit, input) },
            runtime,
          ),
        {},
        (result) => ({
          outcome: result.exitCode === 0 ? 'COMPLETED' : 'FAILED',
          workerObservation: result.workerObservation ?? {
            status: 'UNOBSERVED',
            reason: 'NOT_EMITTED',
          },
        }),
      );
    },
    dispatch: (task) => {
      const action = () =>
        dispatchPdfProvider(prisma, { authority, task, signal }, testTransport);
      if (!observer) return action();
      const unit = observer.nextUnit('provider');
      return observer.track(
        'PROVIDER_WORK',
        unit,
        action,
        { purpose: task.purpose, pageIndices: task.pageIndices },
        (receipt) => {
          observer.emit('REUSE_OBSERVED', 'PROVIDER', unit, {
            callId: receipt.callId,
            cacheReuse: { kind: 'PROVIDER_RECEIPT', reused: receipt.reused },
          });
          return { callId: receipt.callId };
        },
      );
    },
    stageArtifact: (descriptor, bytes) => {
      const action = () =>
        stagePdfStreamArtifact(prisma, authority, descriptor, bytes);
      return observer
        ? observer.track('STAGING', observer.nextUnit('artifact'), action)
        : action();
    },
    progress,
  };
}
