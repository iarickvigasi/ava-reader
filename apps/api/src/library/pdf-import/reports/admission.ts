import { randomUUID } from 'node:crypto';
import {
  HttpException,
  ServiceUnavailableException,
  GoneException,
} from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { costTransaction } from '../providers/cost-lock';
import { beginInvestigationRecord } from './record';
import { appendConversionEvent } from './append-event';
import { refreshConversionCost } from './refresh-cost';
import { safeEventSchema, eventIdentity } from './event-contract';

export type AdmissionIdentity = {
  conversionId: string;
  requestAttemptId: string;
  ownerId: string;
};
export async function beginConversionAdmission(
  prisma: PrismaService,
  ownerId: string,
  rawKey: unknown,
): Promise<AdmissionIdentity> {
  const key =
    typeof rawKey === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(rawKey)
      ? rawKey
      : undefined;
  const requestAttemptId = randomUUID();
  try {
    const outcome = await costTransaction(prisma, async (tx) => {
      const record = await beginInvestigationRecord(tx, ownerId, key);
      if (
        record.operationKey &&
        !(await tx.pdfImportOperation.findUnique({
          where: { id: record.operationKey },
        }))
      ) {
        // Retained audit identity is also the immutable replay tombstone. This
        // new refused attempt commits without reopening or zeroing old costs.
        await appendConversionEvent(
          tx,
          record.id,
          `removed:${requestAttemptId}`,
          {
            kind: 'ADMISSION_REFUSED',
            stage: 'ADMISSION',
            severity: 'WARN',
            code: 'PDF_IMPORT_REMOVED',
            details: { requestAttemptId },
          },
        );
        return { removed: true as const, conversionId: record.id };
      }
      await tx.pdfConversionInvestigation.update({
        where: { id: record.id },
        data: {
          activeAdmissionCount: { increment: 1 },
          ...(!record.operationKey ? { status: 'ADMISSION' } : {}),
        },
      });
      await appendConversionEvent(
        tx,
        record.id,
        `admission:${requestAttemptId}`,
        {
          kind: 'ADMISSION_REQUEST',
          stage: 'ADMISSION',
          severity: 'INFO',
          details: { requestAttemptId },
        },
      );
      await refreshConversionCost(tx, record.id);
      return {
        removed: false as const,
        conversionId: record.id,
        requestAttemptId,
        ownerId,
      };
    });
    if (outcome.removed)
      throw new GoneException({
        code: 'PDF_IMPORT_REMOVED',
        message: 'This import was removed.',
        investigationId: outcome.conversionId,
      });
    return outcome;
  } catch (error) {
    if (error instanceof GoneException) throw error;
    throw new ServiceUnavailableException({
      code: 'PDF_INVESTIGATION_UNAVAILABLE',
      message: 'PDF import could not start. The upload was not accepted.',
    });
  }
}
export async function refuseConversionAdmission(
  prisma: PrismaService,
  identity: AdmissionIdentity,
  error: unknown,
) {
  const response = error instanceof HttpException ? error.getResponse() : null;
  const data =
    response && typeof response === 'object'
      ? (response as Record<string, unknown>)
      : {};
  const code =
    typeof data.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(data.code)
      ? data.code
      : 'PDF_ADMISSION_UNAVAILABLE';
  const finding =
    data.finding && typeof data.finding === 'object'
      ? (data.finding as Record<string, unknown>)
      : {};
  const event = safeEventSchema.parse({
    kind: 'ADMISSION_REFUSED',
    stage: 'ADMISSION',
    severity: 'WARN',
    code,
    details: {
      requestAttemptId: identity.requestAttemptId,
      ...(finding.page_number
        ? {
            locations: [
              {
                pageNumber: finding.page_number,
                annotationNumber: finding.annotation_number,
                relationshipPath: finding.relationship_path,
              },
            ],
          }
        : {}),
    },
  });
  await costTransaction(prisma, async (tx) => {
    const record = await tx.pdfConversionInvestigation.findUniqueOrThrow({
      where: { id: identity.conversionId },
    });
    if (record.ownerId !== identity.ownerId)
      throw new Error('PDF_REPORT_OWNER_CONFLICT');
    const duplicate = await tx.pdfConversionEvent.findUnique({
      where: {
        conversionId_producerKey: {
          conversionId: record.id,
          producerKey: eventIdentity(
            `refusal:${identity.requestAttemptId}`,
            event,
          ).producerKey,
        },
      },
    });
    if (duplicate) {
      await appendConversionEvent(
        tx,
        record.id,
        `refusal:${identity.requestAttemptId}`,
        event,
      );
      return;
    }
    const completed = await tx.pdfConversionEvent.findUnique({
      where: {
        conversionId_producerKey: {
          conversionId: record.id,
          producerKey: eventIdentity(`completed:${identity.requestAttemptId}`, {
            kind: 'ADMISSION_COMPLETED',
            stage: 'ADMISSION',
            severity: 'INFO',
            details: { requestAttemptId: identity.requestAttemptId },
          }).producerKey,
        },
      },
    });
    // Another active request sharing a transiently refused key can still finish.
    if (!completed && record.activeAdmissionCount < 1)
      throw new Error('PDF_REPORT_ADMISSION_OUTCOME_CONFLICT');
    const remaining = record.activeAdmissionCount - (completed ? 0 : 1);
    await tx.pdfConversionInvestigation.update({
      where: { id: record.id },
      data: {
        activeAdmissionCount: remaining,
        ...(!record.operationKey
          ? { status: remaining ? 'ADMISSION' : 'REFUSED', stage: 'ADMISSION' }
          : {}),
      },
    });
    await appendConversionEvent(
      tx,
      record.id,
      `refusal:${identity.requestAttemptId}`,
      event,
    );
    await refreshConversionCost(tx, record.id);
  });
}
export async function completeConversionAdmission(
  prisma: PrismaService,
  identity: AdmissionIdentity,
) {
  await costTransaction(prisma, async (tx) => {
    const record = await tx.pdfConversionInvestigation.findUniqueOrThrow({
      where: { id: identity.conversionId },
    });
    if (record.ownerId !== identity.ownerId)
      throw new Error('PDF_REPORT_OWNER_CONFLICT');
    const event = {
      kind: 'ADMISSION_COMPLETED' as const,
      stage: 'ADMISSION',
      severity: 'INFO' as const,
      details: { requestAttemptId: identity.requestAttemptId },
    };
    const producer = `completed:${identity.requestAttemptId}`;
    if (
      await tx.pdfConversionEvent.findUnique({
        where: {
          conversionId_producerKey: {
            conversionId: record.id,
            producerKey: eventIdentity(producer, event).producerKey,
          },
        },
      })
    ) {
      await appendConversionEvent(tx, record.id, producer, event);
      return;
    }
    const refused = await tx.pdfConversionEvent.findUnique({
      where: {
        conversionId_producerKey: {
          conversionId: record.id,
          producerKey: eventIdentity(
            `refusal:${identity.requestAttemptId}`,
            event,
          ).producerKey,
        },
      },
    });
    if (refused || record.activeAdmissionCount < 1)
      throw new Error('PDF_REPORT_ADMISSION_OUTCOME_CONFLICT');
    await tx.pdfConversionInvestigation.update({
      where: { id: record.id },
      data: { activeAdmissionCount: record.activeAdmissionCount - 1 },
    });
    await appendConversionEvent(tx, record.id, producer, event);
    await refreshConversionCost(tx, record.id);
  });
}
