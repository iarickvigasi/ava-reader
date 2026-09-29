import type { Prisma } from '@prisma/client';
import { checkExistingPdfImport } from './check-existing';

it('sees a purge receipt committed while the live operation lookup is in flight', async () => {
  const identity = {
    idempotencyKey: 'request',
    requestSha256: 'request-hash',
    sourceSha256: 'source-hash',
    configSha256: 'config-hash',
  };
  let purgeCommitted = false;
  const store = {
    pdfImportOperation: {
      findUnique: jest.fn(() => {
        purgeCommitted = true;
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    pdfImportReceipt: {
      findUnique: jest.fn(() =>
        Promise.resolve(purgeCommitted ? identity : null),
      ),
      findFirst: jest.fn().mockResolvedValue(identity),
    },
  };
  await expect(
    checkExistingPdfImport(
      store as unknown as Prisma.TransactionClient,
      'owner',
      identity,
    ),
  ).rejects.toMatchObject({ response: { code: 'PDF_IMPORT_REMOVED' } });
  expect(store.pdfImportReceipt.findUnique).toHaveBeenCalledWith({
    where: {
      ownerId_idempotencyKey: { ownerId: 'owner', idempotencyKey: 'request' },
    },
  });
});
