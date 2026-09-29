import type { PdfImportOperation } from '@prisma/client';
import type { Tx } from './types';
export async function stopOperation(
  tx: Tx,
  op: PdfImportOperation,
  now: Date,
  reason: string,
) {
  if (['FAILED', 'READY', 'STOPPED'].includes(op.status))
    return { status: op.status };
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
  return { status: 'STOPPED' as const };
}
