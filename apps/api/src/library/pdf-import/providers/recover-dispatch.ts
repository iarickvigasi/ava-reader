import type { Tx } from '../jobs/types';
import { recordPdfProviderEvent } from '../reports/provider-event';
// A new execution cannot assume an older process failed before sending.
export async function fenceAbandonedProviderDispatch(
  tx: Tx,
  grantId: string,
  routeId: string,
  currentAttemptId: string,
) {
  const calls = await tx.pdfProviderCall.findMany({
    where: {
      grantId,
      state: 'DISPATCHING',
      dispatchAttemptId: { not: currentAttemptId },
    },
  });
  for (const call of calls) {
    await tx.pdfProviderCall.update({
      where: { id: call.id },
      data: { state: 'UNCERTAIN', failureCode: 'OUTCOME_UNKNOWN' },
    });
    await recordPdfProviderEvent(tx, {
      data: {
        callId: call.id,
        kind: 'ABANDONED_DISPATCH',
        evidenceSha256: call.requestSha256,
        details: {},
      },
    });
  }
  if (calls.length)
    await tx.pdfProviderRoute.updateMany({
      where: { id: routeId, state: 'ACTIVE' },
      data: { state: 'PAUSED_UNCERTAIN' },
    });
}
