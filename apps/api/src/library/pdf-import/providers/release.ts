import type { PrismaService } from '../../../prisma/prisma.service';
import { costTransaction } from './cost-lock';
import { databaseNow } from '../jobs/transaction';
import { PdfProviderError } from './errors';
import { recordPdfProviderEvent } from '../reports/provider-event';
export function releaseUndispatchedPdfCall(
  prisma: PrismaService,
  callId: string,
) {
  return costTransaction(prisma, async (tx) => {
    const call = await tx.pdfProviderCall.findUniqueOrThrow({
      where: { id: callId },
      include: { allocations: true },
    });
    if (call.state === 'RELEASED') return { state: 'RELEASED' };
    if (call.state !== 'RESERVED' || call.dispatchedAt)
      throw new PdfProviderError('PDF_PROVIDER_OUTCOME_UNCERTAIN');
    for (const allocation of call.allocations) {
      await tx.pdfProviderBudget.update({
        where: { id: allocation.budgetId },
        data: { reservedNano: { decrement: allocation.reservedNano } },
      });
      await tx.pdfProviderAllocation.update({
        where: { id: allocation.id },
        data: { reservedNano: 0n },
      });
    }
    await tx.pdfProviderCall.update({
      where: { id: call.id },
      data: { state: 'RELEASED', settledAt: await databaseNow(tx) },
    });
    await recordPdfProviderEvent(tx, {
      data: {
        callId: call.id,
        kind: 'RELEASED_BEFORE_DISPATCH',
        evidenceSha256: call.requestSha256,
        details: {},
      },
    });
    return { state: 'RELEASED' };
  });
}
