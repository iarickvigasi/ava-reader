import { ConflictException, GoneException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { serializePdfImport } from './import-status';
import { checkPdfImportReceipt } from '../retention/check-receipt';

type Identity = {
  idempotencyKey: string;
  requestSha256: string;
  sourceSha256: string;
  configSha256: string;
};
export async function checkExistingPdfImport(
  tx: Prisma.TransactionClient,
  userId: string,
  identity: Identity,
) {
  const existing = await tx.pdfImportOperation.findUnique({
    where: {
      ownerId_idempotencyKey: {
        ownerId: userId,
        idempotencyKey: identity.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (
      existing.requestSha256 !== identity.requestSha256 ||
      existing.configSha256 !== identity.configSha256
    )
      throw new ConflictException({
        code: 'IMPORT_REQUEST_CONFLICT',
        message: 'This request belongs to another upload.',
      });
    if (existing.deletedAt) throw new GoneException('This import was deleted.');
    return serializePdfImport(existing, 'existing');
  }
  // Check the retained receipt after the live lookup so a concurrent purge cannot create a gap.
  await checkPdfImportReceipt(tx, userId, identity);
  const duplicate = await tx.pdfImportOperation.findFirst({
    where: { ownerId: userId, sourceSha256: identity.sourceSha256 },
  });
  const removedDuplicate = await tx.pdfImportReceipt.findFirst({
    where: { ownerId: userId, sourceSha256: identity.sourceSha256 },
  });
  if (duplicate || removedDuplicate)
    throw new ConflictException({
      code: 'PDF_ALREADY_IMPORTED',
      message: 'This PDF already has an import.',
      ...(!duplicate || duplicate.deletedAt
        ? {}
        : {
            operationId: duplicate.id,
            libraryItemId: duplicate.libraryItemId,
            status: duplicate.status,
          }),
    });
  return null;
}
