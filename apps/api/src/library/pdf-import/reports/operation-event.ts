import type { Prisma } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { costLock } from '../providers/cost-lock';
import { ensureOperationInvestigation } from './record';
import { appendConversionEvent } from './append-event';
import { refreshConversionCost, isolateReportMirror } from './refresh-cost';
import type { SafeConversionEvent } from './event-contract';

// Job callers acquire queue first, cost second, report last. Critical lifecycle
// writes and their event share one transaction; no blob/network work lives here.
export async function recordOperationEvent(
  tx: Tx,
  operationKey: string,
  producer: string,
  event: SafeConversionEvent,
  snapshot: Prisma.PdfConversionInvestigationUncheckedUpdateInput = {},
  reconcile = false,
) {
  await costLock(tx);
  const record = await ensureOperationInvestigation(tx, operationKey);
  await tx.pdfConversionInvestigation.update({
    where: { id: record.id },
    data: snapshot,
  });
  await appendConversionEvent(tx, record.id, producer, event);
  if (reconcile)
    await isolateReportMirror(tx, async () => {
      await refreshConversionCost(tx, record.id);
    });
  return record.id;
}
