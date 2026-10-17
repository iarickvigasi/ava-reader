import type { PrismaService } from '../../prisma/prisma.service';
import type { EpubClaim } from './claim-authority';
import { failEpubAttempt } from './fail-attempt';
import { epubFailureCode } from './failure-code';
import { recordEpubEvent } from './diagnostics';
export async function settleEpubFailure(
  prisma: PrismaService,
  claim: EpubClaim,
  classified: unknown,
) {
  const outcome = await failEpubAttempt(prisma, claim, classified);
  await recordEpubEvent(prisma, claim.runId, {
    kind: 'FAILED',
    stage: 'EPUB_PREPARATION',
    severity: 'WARN',
    code:
      outcome === 'SETTLEMENT_UNAVAILABLE'
        ? 'FAILURE_SETTLEMENT_UNAVAILABLE'
        : epubFailureCode(classified),
    attemptFence: claim.fence,
    details: {
      outcome:
        outcome === 'AUTHORITY_LOST'
          ? 'ABORTED'
          : outcome === 'SETTLEMENT_UNAVAILABLE'
            ? 'UNOBSERVED'
            : 'FAILED',
      failureCode: epubFailureCode(classified),
    },
  });
}
