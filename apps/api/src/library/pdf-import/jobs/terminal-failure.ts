import type { PdfConversionJob, PdfImportOperation } from '@prisma/client';
import type { ExecutionFailure, Tx } from './types';
import { failureReason } from './failure-reason';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
export async function terminalFailure(
  tx: Tx,
  input: {
    job: PdfConversionJob;
    operation: PdfImportOperation;
    attemptId?: string;
    candidateAttemptId?: string;
    code: ExecutionFailure;
    now: Date;
  },
) {
  await costLock(tx);
  const { job, operation: op, attemptId, code, now } = input;
  const receipt = await tx.pdfJobFailure.create({
    data: {
      operationId: op.id,
      attemptId: attemptId ?? input.candidateAttemptId,
      stage: op.stage,
      code,
      safeReason: failureReason(code),
      sourceSha256: op.sourceSha256,
      configSha256: op.configSha256,
      generation: op.generation,
      cancellationEpoch: op.cancellationEpoch,
      attemptFence: job.attemptFence,
    },
  });
  await tx.pdfNotificationIntent.create({
    data: { operationId: op.id, failureId: receipt.id },
  });
  if (attemptId)
    await tx.pdfJobAttempt.update({
      where: { id: attemptId },
      data: { status: 'FAILED', failureCode: code, finishedAt: now },
    });
  await tx.pdfConversionJob.update({
    where: { id: job.id },
    data: { state: 'FAILED', waitReason: null },
  });
  await tx.pdfImportOperation.update({
    where: { id: op.id },
    data: {
      status: 'FAILED',
      failureId: receipt.id,
      failureCode: code,
      failureReason: receipt.safeReason,
      investigationMarkedAt: now,
      notificationPendingAt: now,
    },
  });
  await recordOperationEvent(
    tx,
    op.id,
    `failure:${receipt.id}`,
    {
      kind: 'FAILED',
      stage: op.stage,
      severity: 'ERROR',
      code,
      attemptId: attemptId ?? input.candidateAttemptId,
      attemptFence: job.attemptFence,
      generation: op.generation,
      cancellationEpoch: op.cancellationEpoch,
      observedAt: now.toISOString(),
      details: { failureId: receipt.id, jobId: job.id },
    },
    { status: 'FAILED', stage: op.stage, failureId: receipt.id },
    true,
  );
  return { status: 'FAILED' as const, failureId: receipt.id };
}
