import type { PrismaService } from '../../../prisma/prisma.service';
import { costTransaction } from '../providers/cost-lock';
import { ensureOperationInvestigation } from './record';
import { refreshConversionCost } from './refresh-cost';
// Trusted operator repair of a derived report only. No dispatch, settlement,
// route grant, job restart or accepted-content mutation is possible here.
export function reconcileConversionReport(
  prisma: PrismaService,
  reference: string,
) {
  return costTransaction(prisma, async (tx) => {
    // Pre-job refusals have a durable direct ID but no operation key. Reuse
    // that row before the accepted/historical operation-key backfill path.
    const record =
      (await tx.pdfConversionInvestigation.findUnique({
        where: { id: reference },
      })) ?? (await ensureOperationInvestigation(tx, reference));
    const cost = await refreshConversionCost(tx, record.id);
    return {
      conversionId: record.id,
      state: cost.state,
      ledgerWatermark: cost.ledgerWatermark,
    };
  });
}
