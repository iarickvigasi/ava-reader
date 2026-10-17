import type { PrismaService } from '../../../prisma/prisma.service';
import { runPdfProviderAdmin } from '../providers/admin-command';

type Header = {
  id: string;
  operationKey: string | null;
  status: string;
  activeAdmissionCount: number;
  coverage: string;
  [key: string]: unknown;
};
function fixture(
  initial: Header | null,
  historical?: Record<string, unknown>,
  charged = false,
) {
  let header = initial;
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
    pdfConversionInvestigation: {
      findUnique: jest.fn(
        ({ where }: { where: { id?: string; operationKey?: string } }) =>
          Promise.resolve(
            header &&
              (where.id === header.id ||
                (where.operationKey !== undefined &&
                  where.operationKey === header.operationKey))
              ? header
              : null,
          ),
      ),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(header)),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        if (header?.id === data.id)
          return Promise.reject(
            new Error('SYNTHETIC_DUPLICATE_INVESTIGATION_ID'),
          );
        header = { activeAdmissionCount: 0, ...data } as Header;
        return Promise.resolve(header);
      }),
    },
    pdfImportOperation: {
      findUnique: jest.fn().mockResolvedValue(historical ?? null),
      create: jest.fn(),
      update: jest.fn(),
    },
    pdfProviderGrant: {
      findUnique: jest.fn().mockResolvedValue(
        charged
          ? {
              id: 'grant',
              routeId: 'route',
              route: {
                modelId: 'model',
                providerSlug: 'provider',
                tariffSha256: 'a'.repeat(64),
                configurationSha256: 'b'.repeat(64),
              },
            }
          : null,
      ),
    },
    pdfProviderCall: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'call-one',
          state: 'SETTLED',
          reservedNano: 100n,
          actualNano: 30n,
          requestSha256: 'c'.repeat(64),
          receiptSha256: 'd'.repeat(64),
          providerGenerationId: 'gen-one',
          events: [],
        },
      ]),
      create: jest.fn(),
      update: jest.fn(),
    },
    pdfConversionCost: {
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve(create),
      ),
    },
    book: { create: jest.fn() },
    pdfConversionJob: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((work: (value: typeof tx) => unknown) =>
      Promise.resolve(work(tx)),
    ),
  } as unknown as PrismaService;
  return { tx, prisma, header: () => header };
}
function assertNoNewWork(tx: ReturnType<typeof fixture>['tx']) {
  expect(tx.book.create).not.toHaveBeenCalled();
  expect(tx.pdfConversionJob.create).not.toHaveBeenCalled();
  expect(tx.pdfImportOperation.create).not.toHaveBeenCalled();
  expect(tx.pdfImportOperation.update).not.toHaveBeenCalled();
  expect(tx.pdfProviderCall.create).not.toHaveBeenCalled();
  expect(tx.pdfProviderCall.update).not.toHaveBeenCalled();
}

it('refresh-report reuses the direct ID of an existing pre-job REFUSED conversion without a duplicate record or new import', async () => {
  const original: Header = {
    id: 'pdf-refused',
    operationKey: null,
    status: 'REFUSED',
    activeAdmissionCount: 0,
    coverage: 'API_LIFECYCLE',
  };
  const f = fixture(original);
  await expect(
    runPdfProviderAdmin(f.prisma, ['refresh-report', original.id]),
  ).resolves.toMatchObject({ conversionId: original.id, state: 'FINAL' });
  expect(f.header()).toBe(original);
  expect(f.tx.pdfConversionInvestigation.create).not.toHaveBeenCalled();
  expect(f.tx.pdfImportOperation.findUnique).not.toHaveBeenCalled();
  expect(f.tx.pdfConversionCost.upsert.mock.calls[0][0].create).toMatchObject({
    knownActualNano: 0n,
    callCount: 0,
    actualComplete: true,
  });
  assertNoNewWork(f.tx);
});
it('retained accepted operation-key lookup still joins the immutable ledger and preserves the original conversion/outcome', async () => {
  const original: Header = {
    id: 'conversion-retained',
    operationKey: 'old-operation',
    status: 'FAILED',
    activeAdmissionCount: 0,
    coverage: 'API_LIFECYCLE',
  };
  const f = fixture(original, undefined, true);
  await expect(
    runPdfProviderAdmin(f.prisma, ['refresh-report', 'old-operation']),
  ).resolves.toMatchObject({ conversionId: original.id, state: 'FINAL' });
  expect(f.header()).toBe(original);
  expect(f.tx.pdfProviderGrant.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { operationKey: 'old-operation' } }),
  );
  expect(f.tx.pdfConversionCost.upsert.mock.calls[0][0].create).toMatchObject({
    knownActualNano: 30n,
    callCount: 1,
  });
  expect(f.tx.pdfConversionInvestigation.create).not.toHaveBeenCalled();
  assertNoNewWork(f.tx);
});
it('backfills an absent historical record without inventing final zero when ledger history is unavailable', async () => {
  const f = fixture(null, {
    id: 'old-operation',
    ownerId: 'owner',
    idempotencyKey: 'request-key-12345678',
    bookId: 'book-old',
    libraryItemId: 'library-old',
    sourceSha256: 'a'.repeat(64),
    configSha256: 'b'.repeat(64),
    profileId: 'profile-old',
    status: 'FAILED',
    stage: 'VALIDATION',
    failureId: 'failure-old',
    finalContentId: null,
  });
  await expect(
    runPdfProviderAdmin(f.prisma, ['refresh-report', 'old-operation']),
  ).resolves.toMatchObject({
    conversionId: 'old-operation',
    state: 'INCOMPLETE',
  });
  expect(f.header()).toMatchObject({
    operationKey: 'old-operation',
    coverage: 'HISTORICAL_SNAPSHOT',
  });
  expect(f.header()?.evidenceGaps).toContain('HISTORY_BEFORE_CAPTURE');
  expect(f.tx.pdfConversionCost.upsert.mock.calls[0][0].create).toMatchObject({
    actualComplete: false,
  });
  assertNoNewWork(f.tx);
});
it('propagates projection persistence failure without creating an import or dispatching a call', async () => {
  const f = fixture({
    id: 'pdf-refused',
    operationKey: null,
    status: 'REFUSED',
    activeAdmissionCount: 0,
    coverage: 'API_LIFECYCLE',
  });
  f.tx.pdfConversionCost.upsert.mockRejectedValueOnce(
    new Error('SYNTHETIC_REPORT_WRITE_FAILED'),
  );
  await expect(
    runPdfProviderAdmin(f.prisma, ['refresh-report', 'pdf-refused']),
  ).rejects.toThrow('SYNTHETIC_REPORT_WRITE_FAILED');
  assertNoNewWork(f.tx);
});
