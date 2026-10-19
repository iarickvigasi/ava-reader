import type { PrismaService } from '../../../prisma/prisma.service';
import type { PdfInspection } from '../admission/inspect-pdf';
import type { validatePdfUpload } from '../admission/validate-upload';
import { costTransaction } from '../providers/cost-lock';
import { appendConversionEvent } from './append-event';
import type { AdmissionIdentity } from './admission';
import {
  workEventDetails,
  workEventTiming,
  type ConversionWorkTiming,
} from './work-timing';
export async function observeAdmissionSource(
  prisma: PrismaService,
  admission: AdmissionIdentity,
  identity: ReturnType<typeof validatePdfUpload>,
  bytes: number,
  inspection?: PdfInspection,
  work?: ConversionWorkTiming,
) {
  return costTransaction(prisma, async (tx) => {
    const record = await tx.pdfConversionInvestigation.findUniqueOrThrow({
      where: { id: admission.conversionId },
    });
    if (record.ownerId !== admission.ownerId)
      throw new Error('PDF_REPORT_OWNER_CONFLICT');
    if (!record.operationKey)
      await tx.pdfConversionInvestigation.update({
        where: { id: record.id },
        data: {
          sourceSha256: identity.sourceSha256,
          configSha256: identity.configSha256,
          profileId: identity.configuration.profileId,
          sourceBytes: bytes,
          sourcePages: inspection?.page_count,
        },
      });
    await appendConversionEvent(
      tx,
      record.id,
      `${admission.requestAttemptId}:${inspection ? 'inspected' : 'validated'}`,
      {
        kind: inspection ? 'SOURCE_INSPECTED' : 'SOURCE_VALIDATED',
        stage: 'ADMISSION',
        severity: 'INFO',
        ...workEventTiming(work),
        details: {
          ...workEventDetails(work),
          ...(work
            ? {
                unitId: `source-inspection-${admission.requestAttemptId}`,
                outcome: 'COMPLETED' as const,
              }
            : {}),
          requestAttemptId: admission.requestAttemptId,
          sourceSha256: identity.sourceSha256,
          configSha256: identity.configSha256,
          profileId: identity.configuration.profileId,
          sourceBytes: bytes,
          ...(inspection ? { sourcePages: inspection.page_count } : {}),
        },
      },
    );
  });
}
