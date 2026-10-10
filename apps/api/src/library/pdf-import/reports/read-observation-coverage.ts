import type { Tx } from '../jobs/types';
import { retainedEventInput, safeEventSchema } from './event-contract';
import {
  MAX_OBSERVATION_ROWS,
  projectObservationCoverage,
  type ObservationRow,
} from './observation-coverage';

export async function readObservationCoverage(
  tx: Tx,
  id: string,
  watermark: number,
) {
  const rows: ObservationRow[] = [];
  let after = 0;
  while (rows.length < MAX_OBSERVATION_ROWS) {
    const take = Math.min(100, MAX_OBSERVATION_ROWS - rows.length);
    const batch = await tx.pdfConversionEvent.findMany({
      where: { conversionId: id, sequence: { gt: after, lte: watermark } },
      orderBy: { sequence: 'asc' },
      take,
    });
    for (const row of batch) {
      const parsed = safeEventSchema.safeParse(retainedEventInput(row));
      // Discard packet bodies and measurements after safe parsing. Only bounded
      // delivery identities/counters are retained by this projection.
      const event = parsed.success ? parsed.data : undefined;
      const details = event?.details;
      rows.push({
        sequence: row.sequence,
        event: event
          ? {
              kind: event.kind,
              stage: event.stage,
              severity: event.severity,
              attemptId: event.attemptId,
              attemptFence: event.attemptFence,
              generation: event.generation,
              cancellationEpoch: event.cancellationEpoch,
              details: {
                jobId: details?.jobId,
                sourceSha256: details?.sourceSha256,
                configSha256: details?.configSha256,
                profileId: details?.profileId,
                workerFingerprint: details?.workerFingerprint,
                observationProtocol: details?.observationProtocol,
                observationDelivery: details?.observationDelivery,
                observationWatermark: details?.observationWatermark,
                outcome: details?.outcome,
              },
            }
          : { kind: 'INVALID_CAPTURE_EVENT' },
      });
    }
    if (!batch.length || batch.length < take)
      return projectObservationCoverage(rows, watermark);
    after = batch.at(-1)!.sequence;
  }
  const remaining = await tx.pdfConversionEvent.findFirst({
    where: { conversionId: id, sequence: { gt: after, lte: watermark } },
    select: { sequence: true },
  });
  return projectObservationCoverage(rows, watermark, !remaining);
}
