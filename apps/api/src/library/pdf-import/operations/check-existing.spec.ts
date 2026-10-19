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

const copyIdentity = {
  idempotencyKey: 'copy-request',
  requestSha256: 'copy-hash',
  sourceSha256: 'source-hash',
  configSha256: 'config-hash',
  copyOfOperationId: 'pdf-original',
};
function copyStore(source: unknown, existing: unknown = null) {
  return {
    pdfImportOperation: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn().mockResolvedValue(source),
    },
    pdfImportReceipt: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}
it.each(['READY', 'FAILED', 'PROCESSING'])(
  'allows a deliberate independent copy of an owned %s source without mutating it',
  async (status) => {
    const original = {
      id: 'pdf-original',
      ownerId: 'owner',
      sourceSha256: 'source-hash',
      status,
    };
    const snapshot = { ...original };
    const store = copyStore(Object.freeze(original));
    expect(
      await checkExistingPdfImport(
        store as unknown as Prisma.TransactionClient,
        'owner',
        copyIdentity,
      ),
    ).toBeNull();
    expect(original).toEqual(snapshot);
    expect(store.pdfImportOperation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'pdf-original',
        ownerId: 'owner',
        sourceSha256: 'source-hash',
        deletedAt: null,
      },
    });
  },
);
it('refuses an unavailable, deleted, other-owner or different-source copy reference without disclosing it', async () => {
  const store = copyStore(null);
  await expect(
    checkExistingPdfImport(
      store as unknown as Prisma.TransactionClient,
      'owner',
      copyIdentity,
    ),
  ).rejects.toMatchObject({
    response: { code: 'PDF_COPY_SOURCE_UNAVAILABLE' },
  });
});
it('reconciles a previously accepted copy even after its original source was removed, but rejects a changed copy intent', async () => {
  const copy = {
    ...copyIdentity,
    id: 'pdf-copy',
    libraryItemId: 'library-copy',
    status: 'FAILED',
    updatedAt: new Date('2026-10-19T00:00:00Z'),
  };
  const store = copyStore(null, copy);
  expect(
    await checkExistingPdfImport(
      store as unknown as Prisma.TransactionClient,
      'owner',
      copyIdentity,
    ),
  ).toMatchObject({
    operationId: 'pdf-copy',
    libraryItemId: 'library-copy',
    status: 'FAILED',
    updatedAt: '2026-10-19T00:00:00.000Z',
  });
  expect(store.pdfImportOperation.findFirst).not.toHaveBeenCalled();
  await expect(
    checkExistingPdfImport(
      store as unknown as Prisma.TransactionClient,
      'owner',
      { ...copyIdentity, requestSha256: 'changed-copy-intent' },
    ),
  ).rejects.toMatchObject({ response: { code: 'IMPORT_REQUEST_CONFLICT' } });
});

it('prefers the newest live owned copy and only falls back to removed history when none is live', async () => {
  const live = { id: 'pdf-live', libraryItemId: 'live-item', deletedAt: null };
  const store = copyStore(live);
  await expect(
    checkExistingPdfImport(
      store as unknown as Prisma.TransactionClient,
      'owner',
      { ...copyIdentity, copyOfOperationId: undefined },
    ),
  ).rejects.toMatchObject({
    response: {
      code: 'PDF_ALREADY_IMPORTED',
      operationId: 'pdf-live',
      libraryItemId: 'live-item',
    },
  });
  expect(store.pdfImportOperation.findFirst).toHaveBeenCalledTimes(1);
  expect(store.pdfImportOperation.findFirst).toHaveBeenCalledWith({
    where: { ownerId: 'owner', sourceSha256: 'source-hash', deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  expect(store.pdfImportReceipt.findFirst).not.toHaveBeenCalled();
});
