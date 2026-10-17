import { recordEpubDiagnosticLoss } from './diagnostic-loss';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { queueLock } from '../pdf-import/jobs/transaction';
import { costLock } from '../pdf-import/providers/cost-lock';
import { appendConversionEvent } from '../pdf-import/reports/append-event';
import {
  eventIdentity,
  type SafeConversionEvent,
} from '../pdf-import/reports/event-contract';
import {
  epubDiagnosticSnapshot,
  epubInvestigationId,
} from './diagnostic-snapshot';
export const EPUB_EVENT_LIMIT = 96;
export async function recordEpubEvent(
  prisma: PrismaService,
  runId: string,
  event: SafeConversionEvent & { attemptFence: number },
) {
  try {
    await prisma.$transaction(
      async (tx) => {
        await queueLock(tx);
        await costLock(tx);
        const id = epubInvestigationId(runId);
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'ava-pdf-report:' + id},0))`,
        );
        const { run, record } = await epubDiagnosticSnapshot(tx, runId);
        const stale = event.attemptFence !== run.attemptFence;
        const input = stale
          ? {
              ...event,
              attemptId: run.id,
              kind: 'STOPPED' as const,
              severity: 'WARN' as const,
              code: 'STALE_FENCE_OBSERVATION',
              details: {
                ...event.details,
                outcome: 'ABORTED' as const,
                failureCode: event.code,
              },
            }
          : { ...event, attemptId: run.id };
        const producer = `${run.id}:${input.attemptFence}:${input.stage}:${input.kind}:${input.code ?? ''}`;
        if (stale && !record.evidenceGaps.includes('STALE_FENCE_OBSERVATION'))
          await tx.pdfConversionInvestigation.update({
            where: { id },
            data: {
              evidenceGaps: [...record.evidenceGaps, 'STALE_FENCE_OBSERVATION'],
            },
          });
        const identity = eventIdentity(producer, input);
        // First observation of a phase/outcome per fence is retained verbatim.
        // Repeated activation polls do not create conflicting timestamps or unbounded rows.
        if (
          await tx.pdfConversionEvent.findUnique({
            where: {
              conversionId_producerKey: {
                conversionId: id,
                producerKey: identity.producerKey,
              },
            },
          })
        )
          return;
        if (record.nextSequence >= EPUB_EVENT_LIMIT) {
          await tx.pdfConversionInvestigation.update({
            where: { id },
            data: {
              evidenceGaps: [
                ...new Set([
                  ...record.evidenceGaps,
                  ...(stale ? ['STALE_FENCE_OBSERVATION'] : []),
                  'EPUB_EVENT_OVERFLOW',
                ]),
              ],
            },
          });
          return;
        }
        await appendConversionEvent(tx, id, producer, input);
        await tx.pdfConversionInvestigation.update({
          where: { id },
          data: { stage: stale ? record.stage : event.stage },
        });
      },
      { timeout: 2000, maxWait: 1000 },
    );
    return true;
  } catch {
    await recordEpubDiagnosticLoss(prisma, runId);
    return false;
  }
}
