import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { validatePdfUpload } from './admission/validate-upload';
import { inspectPdf } from './admission/inspect-pdf';
import { stagePdfSource } from './artifacts/stage-source';
import { checkExistingPdfImport } from './operations/check-existing';
import { acceptPdfImport } from './operations/accept-import';
import { assertPdfQueueCapacity } from './jobs/queue-capacity';

export async function importPdf(input: {
  prisma: PrismaService;
  userId: string;
  file: Express.Multer.File;
  idempotencyKey: unknown;
  convertToEpub: unknown;
}) {
  const identity = validatePdfUpload({
    ...input,
    profileId: process.env.AVA_PDF_IMPORT_PROFILE,
  });
  const captured = {
    ...input,
    file: { ...input.file, buffer: Buffer.from(input.file.buffer) },
  };
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
      return acceptPdfImport(tx, {
        ...identity,
        userId: captured.userId,
        artifact,
        filename: captured.file.originalname,
        inspection,
      });
    },
    { timeout: 15_000 },
  );
}
