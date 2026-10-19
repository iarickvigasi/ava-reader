import type { PrismaService } from '../../prisma/prisma.service';
import type { claimCanonicalEpub } from './claim';
import { recordEpubEvent } from './diagnostics';
export async function recordEpubClaim(
  prisma: PrismaService,
  claim: NonNullable<Awaited<ReturnType<typeof claimCanonicalEpub>>>,
) {
  await recordEpubEvent(prisma, claim.runId, {
    kind: claim.recoveredExpiredLease ? 'RECOVERED' : 'CLAIMED',
    stage: 'EPUB_CLAIM',
    severity: 'INFO',
    code: claim.recoveredExpiredLease ? 'EXPIRED_LEASE_RECLAIM' : 'CLAIMED',
    attemptFence: claim.fence,
    observedAt: claim.claimedAt.toISOString(),
    details: {},
  });
  if (claim.fence === 1) {
    const durationMs = claim.claimedAt.getTime() - claim.queuedAt.getTime();
    const measured =
      Number.isSafeInteger(durationMs) &&
      durationMs >= 0 &&
      durationMs <= 86400000;
    await recordEpubEvent(prisma, claim.runId, {
      kind: 'STAGE_ENDED',
      stage: 'EPUB_QUEUE',
      attemptFence: claim.fence,
      severity: 'INFO',
      ...(measured
        ? { durationMs, durationKind: 'OBSERVED_WALL_CLOCK' as const }
        : {}),
      details: {
        startedAt: claim.queuedAt.toISOString(),
        endedAt: claim.claimedAt.toISOString(),
        timingStatus: measured ? 'MEASURED' : 'UNOBSERVED',
        outcome: 'COMPLETED',
      },
    });
  }
}
