import type { PrismaService } from '../../../prisma/prisma.service';
import type { Tx } from '../jobs/types';
import { adminReportRead, readReportEvents, readReportCost } from './read';
import { projectConversionCost } from './cost-projection';
const record = {
  id: 'conversion',
  operationKey: 'old-operation',
  operationId: null,
  status: 'REFUSED',
  nextSequence: 3,
  activeAdmissionCount: 0,
};
it('denies a reader before reading another conversion and rechecks revocation after asynchronous reads', async () => {
  const user = {
    findUnique: jest.fn().mockResolvedValue({ roleMemberships: [] }),
  };
  const work = jest.fn();
  const prisma = { user, $transaction: jest.fn(work) };
  await expect(
    adminReportRead(prisma as unknown as PrismaService, 'reader', work),
  ).rejects.toThrow('AVA reviewer access required');
  expect(prisma.$transaction).not.toHaveBeenCalled();
  user.findUnique
    .mockResolvedValueOnce({ roleMemberships: [{ role: 'ADMIN' }] })
    .mockResolvedValueOnce({ roleMemberships: [] });
  prisma.$transaction.mockResolvedValue('private');
  await expect(
    adminReportRead(prisma as unknown as PrismaService, 'admin', work),
  ).rejects.toThrow('AVA reviewer access required');
});
it('exports only safe event fields and refuses corrupted private event JSON', async () => {
  const tx = {
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(record),
    },
    pdfConversionEvent: {
      findMany: jest.fn().mockResolvedValue([
        {
          sequence: 1,
          createdAt: new Date(),
          kind: 'FAILED',
          stage: 'EXTRACTION',
          severity: 'ERROR',
          details: { prompt: 'private text' },
        },
      ]),
    },
  };
  await expect(
    readReportEvents(tx as unknown as Tx, 'conversion'),
  ).rejects.toThrow();
});
it('cost lookup does not depend on a live operation, Library row or diagnostic events', async () => {
  const expected = projectConversionCost([], true);
  const tx = {
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(record),
    },
    pdfConversionCost: {
      findUnique: jest.fn().mockResolvedValue({
        ...expected,
        knownActualNano: 0n,
        reservedNano: 0n,
        uncertainNano: 0n,
        reconciledAt: new Date(),
      }),
    },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfImportOperation: {
      findUnique: jest.fn(() => {
        throw new Error('must not read live operation');
      }),
    },
  };
  expect(await readReportCost(tx as unknown as Tx, 'conversion')).toMatchObject(
    {
      state: 'FINAL',
      knownActualNano: '0',
      infrastructure: { compute: 'NOT_MEASURED' },
    },
  );
  expect(tx.pdfImportOperation.findUnique).not.toHaveBeenCalled();
});
it('a missing persisted projection reports missing rather than fabricated final zero', async () => {
  const tx = {
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(record),
    },
    pdfConversionCost: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const result = await readReportCost(tx as unknown as Tx, 'conversion');
  expect(result).toMatchObject({ state: 'MISSING' });
  expect(result).not.toHaveProperty('knownActualNano');
});

it.each([
  { state: 'FINAL' },
  { version: 2 },
  { currency: 'EUR' },
  { callCount: 9 },
])(
  'refuses a stale outcome or incompatible persisted projection %j even with the same empty ledger',
  async (override) => {
    const expected = projectConversionCost([], false);
    const tx = {
      pdfConversionInvestigation: {
        findUnique: jest.fn().mockResolvedValue({
          ...record,
          operationKey: null,
          status: 'ADMISSION',
          activeAdmissionCount: 1,
        }),
      },
      pdfConversionCost: {
        findUnique: jest.fn().mockResolvedValue({
          ...expected,
          ...override,
          knownActualNano: 0n,
          reservedNano: 0n,
          uncertainNano: 0n,
          reconciledAt: new Date(),
        }),
      },
      pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const result = await readReportCost(tx as unknown as Tx, 'conversion');
    expect(result).toMatchObject({
      state: 'INCOMPLETE',
      actualComplete: false,
      calls: [],
    });
    if ('version' in override || 'currency' in override) {
      expect(result).not.toHaveProperty('knownActualNano');
      expect(result).not.toHaveProperty('currency');
    }
  },
);

it('does not invent final historical zero when a historical snapshot has no retained provider ledger', async () => {
  const expected = projectConversionCost([], true);
  const tx = {
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue({
        ...record,
        status: 'READY',
        coverage: 'HISTORICAL_SNAPSHOT',
      }),
    },
    pdfConversionCost: {
      findUnique: jest.fn().mockResolvedValue({
        ...expected,
        knownActualNano: 0n,
        reservedNano: 0n,
        uncertainNano: 0n,
        reconciledAt: new Date(),
      }),
    },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  expect(await readReportCost(tx as unknown as Tx, 'conversion')).toMatchObject(
    {
      state: 'INCOMPLETE',
      actualComplete: false,
      ledgerCoverage: 'HISTORY_UNAVAILABLE',
    },
  );
});

it('native EPUB investigations expose provider cost as not applicable without reading or fabricating a ledger', async () => {
  const tx = {
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue({
        ...record,
        id: 'epub-run-real',
        operationKey: null,
        operationId: null,
        coverage: 'EPUB_PREPARATION',
      }),
    },
    pdfConversionCost: { findUnique: jest.fn() },
    pdfProviderGrant: { findUnique: jest.fn() },
  };
  expect(await readReportCost(tx as unknown as Tx, 'epub-run-real')).toEqual({
    schemaVersion: 1,
    conversionId: 'epub-run-real',
    state: 'MISSING',
    actualComplete: false,
    reason: 'NATIVE_EPUB_PROVIDER_COST_NOT_APPLICABLE',
    ledgerCoverage: 'NOT_APPLICABLE',
    infrastructure: {
      compute: 'NOT_MEASURED',
      storage: 'NOT_MEASURED',
      delivery: 'NOT_MEASURED',
    },
  });
  expect(tx.pdfConversionCost.findUnique).not.toHaveBeenCalled();
  expect(tx.pdfProviderGrant.findUnique).not.toHaveBeenCalled();
});
