import type { PrismaService } from '../../prisma/prisma.service';
import {
  heartbeatPdfJob,
  loadPdfJobSource,
  type ClaimedPdfJob,
  type JobProgress,
} from '../../library/pdf-import/jobs';
import type { SemanticValidator } from '../contracts/types';
import type { PdfRuntimeConfig } from './runtime-config';
import { leaseGuard, underLease } from './lease-guard';
import { runReconstruction } from '../reconstruction/run-reconstruction';
import { workerDependencies } from '../reconstruction/worker-dependencies';
import {
  captureMetadataVersion,
  fillReconstructedMetadata,
} from './fill-reconstructed-metadata';
import type { WorkerObserver } from './worker-observer';

export async function runClaimedContent(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
  config: PdfRuntimeConfig,
  semantic: SemanticValidator,
  guard: ReturnType<typeof leaseGuard>,
  observer?: WorkerObserver,
) {
  const observe = <T>(stage: string, action: () => Promise<T>) =>
    observer
      ? observer.track(stage, observer.nextUnit(stage.toLowerCase()), action)
      : action();
  const progress = async (value: JobProgress) => {
    const started = performance.now();
    const receipt = await underLease(
      () =>
        heartbeatPdfJob(prisma, claim.authority, {
          ...value,
          observationWatermark: observer?.snapshot(),
        }),
      guard.signal,
    );
    guard.confirm(receipt, performance.now() - started);
  };
  const source = await observe('LOAD_SOURCE', () =>
    underLease(() => loadPdfJobSource(prisma, claim.authority), guard.signal),
  );
  const metadataVersion = await observe('CAPTURE_METADATA', () =>
    underLease(() => captureMetadataVersion(prisma, claim), guard.signal),
  );
  await progress({ stage: 'EXTRACTION' });
  const result = await observe('RECONSTRUCTION', () =>
    underLease(
      () =>
        runReconstruction(
          {
            job: claim.job,
            source,
            signal: guard.signal,
            leaseRemainingMs: guard.remainingMs,
          },
          workerDependencies(
            prisma,
            claim.authority,
            config,
            guard.signal,
            progress,
            undefined,
            observer,
          ),
          semantic,
          config.image.slice(7),
        ),
      guard.signal,
    ),
  );
  await observe('FILL_METADATA', () =>
    underLease(
      () =>
        fillReconstructedMetadata(prisma, claim, metadataVersion, {
          metadata: result.metadata,
          profile_id: result.profileId,
        }),
      guard.signal,
    ),
  );
  return result;
}
