import type { PrismaService } from '../../prisma/prisma.service';
import { jobTransaction } from '../pdf-import/jobs/transaction';
import { requireEpubClaim, type EpubClaim } from './claim-authority';
export async function heartbeatCanonicalEpub(
  prisma: PrismaService,
  claim: EpubClaim,
) {
  return jobTransaction(prisma, async (tx) => {
    const { run, now } = await requireEpubClaim(tx, claim);
    const expires = new Date(
      Math.min(now.getTime() + 30000, run.activeDeadlineAt!.getTime()),
    );
    await tx.bookProcessingRun.update({
      where: { id: run.id },
      data: { leaseExpiresAt: expires },
    });
    const confirmed = await requireEpubClaim(tx, claim);
    return confirmed.run.leaseExpiresAt!.getTime() - confirmed.now.getTime();
  });
}
export function epubLease(
  prisma: PrismaService,
  claim: EpubClaim,
  initialRemainingMs: number,
) {
  const controller = new AbortController();
  let deadline = performance.now() + Math.max(0, initialRemainingMs),
    pending: Promise<void> | undefined;
  const refresh = () => {
    const started = performance.now();
    pending = heartbeatCanonicalEpub(prisma, claim)
      .then((ms) => {
        deadline = started + ms;
      })
      .catch(() => controller.abort())
      .finally(() => {
        pending = undefined;
      });
  };
  const timer = setInterval(() => {
    if (!pending) refresh();
  }, 10000);
  const expiry = setInterval(() => {
    if (performance.now() >= deadline) controller.abort();
  }, 100);
  return {
    signal: controller.signal,
    remainingMs: () => Math.max(0, deadline - performance.now()),
    async confirm() {
      if (pending) await pending;
      refresh();
      await pending;
      if (controller.signal.aborted || performance.now() >= deadline) {
        controller.abort();
        throw new Error('EPUB_IMPORT_AUTHORITY_INVALID');
      }
    },
    async dispose() {
      clearInterval(timer);
      clearInterval(expiry);
      await pending;
    },
  };
}
