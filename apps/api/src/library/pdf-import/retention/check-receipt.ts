import { ConflictException, GoneException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export async function checkPdfImportReceipt(
  tx: Prisma.TransactionClient,
  ownerId: string,
  identity: {
    idempotencyKey: string;
    requestSha256: string;
    configSha256: string;
  },
) {
  const prior = await tx.pdfImportReceipt.findUnique({
    where: {
      ownerId_idempotencyKey: {
        ownerId,
        idempotencyKey: identity.idempotencyKey,
      },
    },
  });
  if (!prior) return;
  if (
    prior.requestSha256 !== identity.requestSha256 ||
    prior.configSha256 !== identity.configSha256
  )
    throw new ConflictException({
      code: 'IMPORT_REQUEST_CONFLICT',
      message: 'This request belongs to another upload.',
    });
  throw new GoneException({
    code: 'PDF_IMPORT_REMOVED',
    message: 'This import was removed.',
  });
}
