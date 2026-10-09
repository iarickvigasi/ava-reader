import type { PdfImportOperation, PdfConversionJob } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { costLock } from '../providers/cost-lock';
import { appendConversionEvent } from './append-event';
import { refreshConversionCost } from './refresh-cost';
import { ensureOperationInvestigation } from './record';
export async function recordAcceptedImport(
  tx: Tx,
  op: PdfImportOperation,
  job: PdfConversionJob,
  source: { bytes: number; pages: number },
) {
  await costLock(tx);
  let record = await tx.pdfConversionInvestigation.findUnique({
    where: { id: op.id },
  });
  if (!record)
    record = await ensureOperationInvestigation(tx, op.id, op.ownerId);
  if (
    record.ownerId !== op.ownerId ||
    (record.operationKey && record.operationKey !== op.id)
  )
    throw new Error('PDF_REPORT_ACCEPTANCE_CONFLICT');
  await tx.pdfConversionInvestigation.update({
    where: { id: record.id },
    data: {
      operationId: op.id,
      operationKey: op.id,
      bookId: op.bookId,
      libraryItemId: op.libraryItemId,
      jobId: job.id,
      status: op.status,
      stage: op.stage,
      sourceSha256: op.sourceSha256,
      configSha256: op.configSha256,
      profileId: op.profileId,
      sourceBytes: source.bytes,
      sourcePages: source.pages,
    },
  });
  await appendConversionEvent(tx, record.id, `accepted:${op.id}`, {
    kind: 'IMPORT_ACCEPTED',
    stage: op.stage,
    severity: 'INFO',
    details: { operationId: op.id, jobId: job.id },
  });
  await appendConversionEvent(tx, record.id, `queued:${job.id}`, {
    kind: 'QUEUED',
    stage: op.stage,
    severity: 'INFO',
    details: { jobId: job.id },
  });
  await refreshConversionCost(tx, record.id);
}
