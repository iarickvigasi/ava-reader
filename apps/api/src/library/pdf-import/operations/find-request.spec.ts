import type { PrismaService } from '../../../prisma/prisma.service';
import { requestKeyHash } from '../reports/record';
import { findPdfRequest } from './find-request';

const owner = 'reader',
  requestKey = 'owned-upload-request-1',
  sourceSha256 = 'a'.repeat(64);
const refused = Object.freeze({
  id: 'pdf-owned-refusal',
  ownerId: owner,
  requestKeyHash: requestKeyHash(requestKey),
  status: 'REFUSED',
  activeAdmissionCount: 0,
  sourceSha256,
  sourceBytes: 194691,
  operationId: null,
  operationKey: null,
  bookId: null,
  libraryItemId: null,
  jobId: null,
  finalContentId: null,
});
const operation = {
  id: 'operation',
  ownerId: owner,
  bookId: 'book',
  libraryItemId: 'item',
  deletedAt: null,
  status: 'READY',
  stage: 'COMPLETE',
  generation: 1,
  updatedAt: new Date('2026-10-12T12:00:00Z'),
  sourceArtifactId: 'source',
  finalContentId: 'content',
  failureId: null,
  progressCompleted: 4,
  progressTotal: 4,
  investigationMarkedAt: null,
};
function fixture(journal: unknown = refused, op: unknown = null) {
  const tx = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    pdfImportOperation: {
      findUnique: jest.fn().mockResolvedValue(op),
      findFirst: jest.fn().mockResolvedValue(op),
    },
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(journal),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((work: (value: typeof tx) => unknown) =>
      Promise.resolve(work(tx)),
    ),
  };
  return {
    tx,
    prisma: prisma as unknown as PrismaService,
    transaction: prisma.$transaction,
  };
}

it('confirms only an owned source-bound refusal without an accepted operation, using a read-only snapshot', async () => {
  const { prisma, tx, transaction } = fixture();
  await expect(findPdfRequest(prisma, owner, requestKey)).rejects.toMatchObject(
    {
      status: 410,
      response: {
        code: 'PDF_ADMISSION_REFUSED',
        investigationId: refused.id,
        requestKey,
        sourceSha256,
        operationId: null,
      },
    },
  );
  expect(tx.pdfConversionInvestigation.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        ownerId_requestKeyHash: {
          ownerId: owner,
          requestKeyHash: requestKeyHash(requestKey),
        },
      },
    }),
  );
  expect(transaction).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({ isolationLevel: 'RepeatableRead' }),
  );
  expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
    'SET TRANSACTION READ ONLY',
  );
  expect(refused).toEqual(
    expect.objectContaining({
      status: 'REFUSED',
      operationId: null,
      activeAdmissionCount: 0,
    }),
  );
});

const uncertain: [string, unknown][] = [
  ['missing history', null],
  ...['ADMISSION', 'UNKNOWN', 'READY', 'FAILED', 'STOPPED'].map(
    (status): [string, unknown] => [status, { ...refused, status }],
  ),
  ['active admission', { ...refused, activeAdmissionCount: 1 }],
  [
    'removed-operation tombstone',
    { ...refused, operationKey: 'removed-operation' },
  ],
  ['retained operation reference', { ...refused, operationId: 'operation' }],
  ['retained book', { ...refused, bookId: 'book' }],
  ['retained library item', { ...refused, libraryItemId: 'item' }],
  ['retained job', { ...refused, jobId: 'job' }],
  ['retained accepted content', { ...refused, finalContentId: 'content' }],
  ['another owner', { ...refused, ownerId: 'someone-else' }],
  ['different request hash', { ...refused, requestKeyHash: 'b'.repeat(64) }],
  ['absent source', { ...refused, sourceSha256: null }],
  ['invalid source', { ...refused, sourceSha256: 'not-a-source-hash' }],
  ['unknown source size', { ...refused, sourceBytes: null }],
  ['empty source', { ...refused, sourceBytes: 0 }],
  ['invalid investigation identity', { ...refused, id: '../private' }],
];
it.each(uncertain)(
  'keeps %s uncertain and does not disclose a refusal',
  async (_name, journal) => {
    const { prisma } = fixture(journal);
    await expect(
      findPdfRequest(prisma, owner, requestKey),
    ).rejects.toMatchObject({ status: 404 });
  },
);

it.each(['QUEUED', 'RUNNING', 'WAITING', 'READY', 'FAILED', 'STOPPED'])(
  'returns accepted %s before inspecting refusal history',
  async (status) => {
    const { prisma, tx } = fixture(refused, { ...operation, status });
    await expect(
      findPdfRequest(prisma, owner, requestKey),
    ).resolves.toMatchObject({
      operationId: operation.id,
      status,
      libraryItemId: 'item',
    });
    expect(tx.pdfConversionInvestigation.findUnique).not.toHaveBeenCalled();
  },
);

it('preserves the existing deleted-operation response and does not treat it as admission refusal', async () => {
  const { prisma, tx } = fixture(refused, {
    ...operation,
    deletedAt: new Date(),
  });
  await expect(findPdfRequest(prisma, owner, requestKey)).rejects.toMatchObject(
    { status: 410, response: { message: 'This import was deleted.' } },
  );
  expect(tx.pdfConversionInvestigation.findUnique).not.toHaveBeenCalled();
});

it('keeps an accepted operation whose library ownership vanished unavailable', async () => {
  const { prisma, tx } = fixture(refused, operation);
  tx.libraryItem.findFirst.mockResolvedValue(null);
  await expect(findPdfRequest(prisma, owner, requestKey)).rejects.toMatchObject(
    { status: 404 },
  );
  expect(tx.pdfConversionInvestigation.findUnique).not.toHaveBeenCalled();
});

it('does not turn a journal lookup failure into a confirmed refusal', async () => {
  const { prisma, tx } = fixture();
  const unavailable = new Error('controlled lookup unavailable');
  tx.pdfConversionInvestigation.findUnique.mockRejectedValue(unavailable);
  await expect(findPdfRequest(prisma, owner, requestKey)).rejects.toBe(
    unavailable,
  );
});
