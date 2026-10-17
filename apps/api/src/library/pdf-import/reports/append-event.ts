import { Prisma } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { eventIdentity, type SafeConversionEvent } from './event-contract';
import { costLock } from '../providers/cost-lock';

// Job callers hold queue first. Every event writer, including standalone
// reconciliation, takes the same cost mutex before report locks/row writes.
export async function appendConversionEvent(
  tx: Tx,
  conversionId: string,
  producer: string,
  raw: SafeConversionEvent,
) {
  const input = eventIdentity(producer, raw);
  await costLock(tx);
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'ava-pdf-report:' + conversionId},0))`,
  );
  const prior = await tx.pdfConversionEvent.findUnique({
    where: {
      conversionId_producerKey: {
        conversionId,
        producerKey: input.producerKey,
      },
    },
  });
  if (prior) {
    if (prior.payloadSha256 !== input.payloadSha256)
      throw new Error('PDF_REPORT_EVENT_CONFLICT');
    return prior;
  }
  const record = await tx.pdfConversionInvestigation.update({
    where: { id: conversionId },
    data: { nextSequence: { increment: 1 } },
  });
  const event = input.event;
  return tx.pdfConversionEvent.create({
    data: {
      conversionId,
      sequence: record.nextSequence,
      producerKey: input.producerKey,
      payloadSha256: input.payloadSha256,
      kind: event.kind,
      stage: event.stage,
      severity: event.severity,
      code: event.code,
      attemptId: event.attemptId,
      attemptFence: event.attemptFence,
      generation: event.generation,
      cancellationEpoch: event.cancellationEpoch,
      observedAt: event.observedAt ? new Date(event.observedAt) : null,
      durationMs: event.durationMs,
      durationKind: event.durationKind,
      details: event.details as Prisma.InputJsonValue,
    },
  });
}
