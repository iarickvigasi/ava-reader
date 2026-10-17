import { randomUUID, createHash } from 'node:crypto';
import type { Prisma, PdfImportOperation } from '@prisma/client';
import type { Tx } from '../jobs/types';

export const REPORT_GAPS = [
  'WORKER_WORK_DURATIONS',
  'CHECKPOINT_REUSE',
  'CPU_RSS_SCRATCH',
  'DETECTED_LANGUAGE_LAYOUT_ANNOTATION_INVENTORY',
];
export const requestKeyHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function operationSnapshot(
  op: PdfImportOperation,
): Prisma.PdfConversionInvestigationUncheckedCreateInput {
  return {
    id: op.id,
    ownerId: op.ownerId,
    requestKeyHash: requestKeyHash(op.idempotencyKey),
    operationId: op.id,
    operationKey: op.id,
    bookId: op.bookId,
    libraryItemId: op.libraryItemId,
    sourceSha256: op.sourceSha256,
    configSha256: op.configSha256,
    profileId: op.profileId,
    status: op.status,
    stage: op.stage,
    failureId: op.failureId,
    finalContentId: op.finalContentId,
    coverage: 'HISTORICAL_SNAPSHOT',
    evidenceGaps: ['HISTORY_BEFORE_CAPTURE', ...REPORT_GAPS],
  };
}
export async function ensureOperationInvestigation(
  tx: Tx,
  operationKey: string,
  ownerId?: string,
) {
  const existing = await tx.pdfConversionInvestigation.findUnique({
    where: { operationKey },
  });
  if (existing) return existing;
  const op = await tx.pdfImportOperation.findUnique({
    where: { id: operationKey },
  });
  return tx.pdfConversionInvestigation.create({
    data: op
      ? operationSnapshot(op)
      : {
          id: operationKey,
          operationKey,
          ownerId,
          status: 'UNKNOWN',
          stage: 'UNKNOWN',
          coverage: 'HISTORICAL_SNAPSHOT',
          evidenceGaps: ['HISTORY_BEFORE_CAPTURE', ...REPORT_GAPS],
        },
  });
}
export async function beginInvestigationRecord(
  tx: Tx,
  ownerId: string,
  key?: string,
) {
  if (key) {
    const existing = await tx.pdfImportOperation.findUnique({
      where: { ownerId_idempotencyKey: { ownerId, idempotencyKey: key } },
    });
    if (existing) return ensureOperationInvestigation(tx, existing.id, ownerId);
    const prior = await tx.pdfConversionInvestigation.findUnique({
      where: {
        ownerId_requestKeyHash: {
          ownerId,
          requestKeyHash: requestKeyHash(key),
        },
      },
    });
    if (prior) return prior;
  }
  const data = {
    // New trace IDs become operation IDs on acceptance. The worker/canonical
    // contracts require a leading letter; existing retained IDs stay exact.
    id: `pdf-${randomUUID()}`,
    ownerId,
    requestKeyHash: key ? requestKeyHash(key) : null,
    evidenceGaps: REPORT_GAPS,
  };
  return key
    ? tx.pdfConversionInvestigation.upsert({
        where: {
          ownerId_requestKeyHash: {
            ownerId,
            requestKeyHash: requestKeyHash(key),
          },
        },
        create: data,
        update: {},
      })
    : tx.pdfConversionInvestigation.create({ data });
}
