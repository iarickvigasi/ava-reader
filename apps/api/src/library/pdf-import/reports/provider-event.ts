import type { Prisma } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { ensureOperationInvestigation } from './record';
import { appendConversionEvent } from './append-event';
import { isolateReportMirror, refreshConversionCost } from './refresh-cost';
import type { SafeConversionEvent } from './event-contract';
const kinds: Record<string, SafeConversionEvent['kind']> = {
  RESERVED: 'PROVIDER_RESERVED',
  DISPATCH_INTENT: 'PROVIDER_DISPATCH',
  SETTLED: 'PROVIDER_SETTLED',
  BOUND_EXCEEDED: 'PROVIDER_SETTLED',
  RELEASED_BEFORE_DISPATCH: 'PROVIDER_RELEASED',
  OUTCOME_UNKNOWN: 'PROVIDER_UNCERTAIN',
  ABANDONED_DISPATCH: 'PROVIDER_UNCERTAIN',
};

// The original immutable ledger event is outside the mirror savepoint. A
// broken report sink cannot erase a settled receipt or release held exposure.
export async function recordPdfProviderEvent(
  tx: Tx,
  input: Prisma.PdfProviderEventCreateArgs,
) {
  const event = await tx.pdfProviderEvent.create(input);
  await isolateReportMirror(tx, async () => {
    const call = await tx.pdfProviderCall.findUniqueOrThrow({
      where: { id: event.callId },
      include: { grant: true },
    });
    const record = await ensureOperationInvestigation(
      tx,
      call.grant.operationKey,
      call.grant.ownerId,
    );
    const details =
      event.details &&
      typeof event.details === 'object' &&
      !Array.isArray(event.details)
        ? event.details
        : {};
    const purpose =
      details.purpose === 'transcribe_region' ||
      details.purpose === 'resolve_structure'
        ? details.purpose
        : undefined;
    await appendConversionEvent(tx, record.id, `provider-event:${event.id}`, {
      kind: kinds[event.kind] ?? 'PROVIDER_UNCERTAIN',
      stage: 'PROVIDER',
      severity:
        event.kind === 'OUTCOME_UNKNOWN' || event.kind === 'BOUND_EXCEEDED'
          ? 'WARN'
          : 'INFO',
      observedAt: event.createdAt.toISOString(),
      details: {
        callId: call.id,
        providerEventId: event.id,
        ...(purpose ? { purpose } : {}),
        ...(Array.isArray(details.pageIndices)
          ? { pageIndices: details.pageIndices as number[] }
          : {}),
      },
    });
    await refreshConversionCost(tx, record.id);
  });
  return event;
}
