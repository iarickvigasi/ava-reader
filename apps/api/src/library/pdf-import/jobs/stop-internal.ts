import type { PdfImportOperation } from '@prisma/client';
import type { Tx } from './types';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
export async function stopOperation(
  tx: Tx,
  op: PdfImportOperation,
  now: Date,
  reason: string,
) {
  if (['FAILED', 'READY', 'STOPPED'].includes(op.status))
    return { status: op.status };
  await costLock(tx);
  await tx.pdfImportOperation.update({
    where: { id: op.id },
    data: { status: 'STOPPED', cancellationEpoch: { increment: 1 } },
  });
  const job = await tx.pdfConversionJob.findUnique({
    where: { operationId: op.id },
  });
  if (job) {
    await tx.pdfJobAttempt.updateMany({
      where: { jobId: job.id, status: 'RUNNING' },
      data: { status: 'STOPPED', finishedAt: now },
    });
    await tx.pdfConversionJob.update({
      where: { id: job.id },
      data: { state: 'STOPPED', waitReason: reason },
    });
  }
  await recordOperationEvent(
    tx,
    op.id,
    `stop:${op.generation}:${op.cancellationEpoch + 1}`,
    {
      kind: 'STOPPED',
      stage: op.stage,
      severity: 'WARN',
      code: /^[A-Z][A-Z0-9_]{0,79}$/.test(reason) ? reason : 'INTERNAL_STOP',
      generation: op.generation,
      cancellationEpoch: op.cancellationEpoch + 1,
      details: {},
    },
    { status: 'STOPPED' },
    true,
  );
  return { status: 'STOPPED' as const };
}
