import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../../prisma/prisma.service';
import { validatePdfUpload } from '../../admission/validate-upload';
import { inspectPdf } from '../../admission/inspect-pdf';
import { stagePdfSource } from '../../artifacts/stage-source';
import { checkExistingPdfImport } from '../../operations/check-existing';
import { createOwnedPdfImport } from '../../operations/create-owned-import';
import { serializePdfImport } from '../../operations/import-status';
import { assertPdfQueueCapacity } from '../../jobs/queue-capacity';
import { secretDigest } from '../../jobs/secrets';
import { grantPdfProvider } from '../grant';
import { requirePilotOperation } from '../pilot-authority';
import { loadAuthoredPilotRoute } from './route';
import { requirePilotOperator } from './scope';
import { PdfProviderError } from '../errors';
export async function importAuthoredPilot(input: {
  prisma: PrismaService;
  userId: string;
  operationId: string;
  routeId: string;
  file: Express.Multer.File;
}) {
  requirePilotOperator();
  validatePdfUpload({
    file: input.file,
    idempotencyKey: input.operationId,
    convertToEpub: true,
  });
  const value = {
      ...input,
      file: { ...input.file, buffer: Buffer.from(input.file.buffer) },
    },
    identity = validatePdfUpload({
      file: value.file,
      idempotencyKey: value.operationId,
      convertToEpub: true,
    });
  const preflight = await loadAuthoredPilotRoute(value.prisma, value.routeId);
  requirePilotOperation(preflight.config, 'live', {
    operationId: value.operationId,
    ownerId: value.userId,
    sourceSha256: identity.sourceSha256,
  });
  const prior = await checkExistingPdfImport(
    value.prisma,
    value.userId,
    identity,
  );
  if (prior) return prior;
  const inspection = await inspectPdf(value.file.buffer, identity.sourceSha256),
    artifact = await stagePdfSource({
      ...value,
      sourceSha256: identity.sourceSha256,
    });
  return value.prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'pdf-import:' + value.userId}, 0))`,
      );
      const current = await loadAuthoredPilotRoute(tx, value.routeId);
      requirePilotOperation(current.config, 'live', {
        operationId: value.operationId,
        ownerId: value.userId,
        sourceSha256: identity.sourceSha256,
      });
      const existing = await checkExistingPdfImport(tx, value.userId, identity);
      if (existing) return existing;
      const policy = await assertPdfQueueCapacity(tx, value.userId);
      const operation = await createOwnedPdfImport(
        tx,
        {
          ...identity,
          userId: value.userId,
          artifact,
          filename: value.file.originalname,
          inspection,
        },
        value.operationId,
      );
      const grant = await grantPdfProvider(tx, operation, value.routeId);
      if (grant.operationKey !== value.operationId)
        throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
      await tx.pdfConversionJob.create({
        data: {
          operationId: operation.id,
          providerMode: 'live',
          dispatchAuthorizationId: grant.id,
          policy,
          policySha256: secretDigest(JSON.stringify(policy)),
        },
      });
      await loadAuthoredPilotRoute(tx, value.routeId);
      return serializePdfImport(operation, 'accepted');
    },
    { timeout: 15000 },
  );
}
