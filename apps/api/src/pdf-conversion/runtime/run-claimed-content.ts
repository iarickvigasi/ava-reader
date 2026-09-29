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

export async function runClaimedContent(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
  config: PdfRuntimeConfig,
  semantic: SemanticValidator,
  guard: ReturnType<typeof leaseGuard>,
) {
  const progress = async (value: JobProgress) => {
    const started = performance.now();
    const receipt = await underLease(
      () => heartbeatPdfJob(prisma, claim.authority, value),
      guard.signal,
    );
    guard.confirm(receipt, performance.now() - started);
  };
  const source = await underLease(
    () => loadPdfJobSource(prisma, claim.authority),
    guard.signal,
  );
  const metadataVersion = await underLease(
    () => captureMetadataVersion(prisma, claim),
    guard.signal,
  );
  await progress({ stage: 'EXTRACTION' });
  const result = await underLease(
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
        ),
        semantic,
        config.image.slice(7),
      ),
    guard.signal,
  );
  await underLease(
    () =>
      fillReconstructedMetadata(prisma, claim, metadataVersion, {
        metadata: result.metadata,
        profile_id: result.profileId,
      }),
    guard.signal,
  );
  return result;
}
