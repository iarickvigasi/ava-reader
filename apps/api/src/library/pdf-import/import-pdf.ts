import { Prisma } from '@prisma/client';
import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { validatePdfUpload } from './admission/validate-upload';
import { inspectPdf } from './admission/inspect-pdf';
import { stagePdfSource } from './artifacts/stage-source';
import { checkExistingPdfImport } from './operations/check-existing';
import { acceptPdfImport } from './operations/accept-import';
import { assertPdfQueueCapacity } from './jobs/queue-capacity';
import {
  beginConversionAdmission,
  completeConversionAdmission,
  refuseConversionAdmission,
  type AdmissionIdentity,
} from './reports/admission';
import { observeAdmissionSource } from './reports/source-observation';

export async function importPdf(input: {
  prisma: PrismaService;
  userId: string;
  file: Express.Multer.File;
  idempotencyKey: unknown;
  convertToEpub: unknown;
  admission?: AdmissionIdentity;
}) {
  // Admission adds an await before the previous importer boundary. Preserve
  // the exact owner/header/bytes first, including malformed uploads which the
  // admission validation will refuse under the durable reference.
  const captured = {
    ...input,
    admission: input.admission ? { ...input.admission } : undefined,
    file:
      input.file && Buffer.isBuffer(input.file.buffer)
        ? { ...input.file, buffer: Buffer.from(input.file.buffer) }
        : input.file,
  };
  const admission =
    captured.admission ??
    (await beginConversionAdmission(
      captured.prisma,
      captured.userId,
      captured.idempotencyKey,
    ));
  if (admission.ownerId !== captured.userId)
    throw new Error('PDF_REPORT_OWNER_CONFLICT');
  try {
    const result = await performImport(captured, admission);
    try {
      await completeConversionAdmission(captured.prisma, admission);
    } catch {
      throw new ServiceUnavailableException({
        code: 'PDF_IMPORT_ACCEPTED_REPORT_PENDING',
        message: 'PDF import was accepted, but its report could not finish.',
        investigationId: admission.conversionId,
        operationId: result.operationId,
        libraryItemId: result.libraryItemId,
        status: result.status,
      });
    }
    return { ...result, investigationId: admission.conversionId };
  } catch (error) {
    if (!captured.admission)
      await refuseConversionAdmission(captured.prisma, admission, error);
    throw error;
  }
}
async function performImport(
  input: Parameters<typeof importPdf>[0],
  admission: AdmissionIdentity,
) {
  const identity = validatePdfUpload({
    ...input,
    profileId: process.env.AVA_PDF_IMPORT_PROFILE,
  });
  // Only the entry-owned snapshot reaches this private helper. Keep one
  // defensive buffer copy rather than retaining a second maximum-size PDF.
  const captured = input;
  await observeAdmissionSource(
    input.prisma,
    admission,
    identity,
    captured.file.buffer.length,
  );
  const prior = await checkExistingPdfImport(
    captured.prisma,
    captured.userId,
    identity,
  );
  if (prior) return prior;
  const inspection = await inspectPdf(
    captured.file.buffer,
    identity.sourceSha256,
  );
  await observeAdmissionSource(
    input.prisma,
    admission,
    identity,
    captured.file.buffer.length,
    inspection,
  );
  const artifact = await stagePdfSource({
    ...captured,
    sourceSha256: identity.sourceSha256,
  });
  // Pins exist before this transaction. A losing concurrent upload expires under staging policy.
  return captured.prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'pdf-import:' + captured.userId}, 0))`,
      );
      const existing = await checkExistingPdfImport(
        tx,
        captured.userId,
        identity,
      );
      if (existing) return existing;
      await assertPdfQueueCapacity(tx, captured.userId);
      return acceptPdfImport(
        tx,
        {
          ...identity,
          userId: captured.userId,
          artifact,
          filename: captured.file.originalname,
          inspection,
        },
        admission.conversionId,
      );
    },
    { timeout: 15_000 },
  );
}
