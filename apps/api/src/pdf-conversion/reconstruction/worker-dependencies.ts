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

// A dormant integration seam. Route/source/budget authority is checked by the ledger on every call.
export function workerDependencies(
  prisma: PrismaService,
  authority: AttemptAuthority,
  runtime: PdfRuntimeConfig,
  signal: AbortSignal,
  progress: (progress: JobProgress) => Promise<void>,
  testTransport?: ProviderTransport,
): CoordinatorDependencies {
  return {
    sandbox: (input) => runSandbox(input, runtime),
    dispatch: (task) =>
      dispatchPdfProvider(prisma, { authority, task, signal }, testTransport),
    stageArtifact: (descriptor, bytes) =>
      stagePdfStreamArtifact(prisma, authority, descriptor, bytes),
    progress,
  };
}
