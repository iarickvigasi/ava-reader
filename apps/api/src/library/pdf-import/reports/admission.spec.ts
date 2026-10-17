import { UnprocessableEntityException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import {
  beginConversionAdmission,
  refuseConversionAdmission,
} from './admission';
import { admissionRefusalResponse } from './admission-response';
import { costCursor, costPage } from './cost-cursor';
function fixture(operationKey: string | null) {
  const row = {
    id: 'conversion-new',
    ownerId: 'owner',
    operationKey,
    status: operationKey ? 'READY' : 'ADMISSION',
    nextSequence: 0,
    activeAdmissionCount: 1,
  };
  const tx = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
    pdfConversionInvestigation: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({ ...row, nextSequence: 1 }),
    },
    pdfConversionEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfConversionCost: { upsert: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((work: (value: typeof tx) => unknown) =>
      Promise.resolve(work(tx)),
    ),
  };
  return { tx, prisma: prisma as unknown as PrismaService };
}
it('refusal after rollback preserves an accepted/final conversion rather than resetting its outcome', async () => {
  const { tx, prisma } = fixture('existing-operation');
  await refuseConversionAdmission(
    prisma,
    {
      conversionId: 'conversion-new',
      ownerId: 'owner',
      requestAttemptId: 'attempt',
    },
    new UnprocessableEntityException({ code: 'PDF_UNSUPPORTED' }),
  );
  expect(tx.pdfConversionInvestigation.update).not.toHaveBeenCalledWith(
    expect.objectContaining({
      data: { status: 'REFUSED', stage: 'ADMISSION' },
    }),
  );
});
it('pre-job refusal has a separate identity even when an existing duplicate is referenced', async () => {
  const { tx, prisma } = fixture(null);
  const error = new UnprocessableEntityException({
    code: 'PDF_ALREADY_IMPORTED',
    operationId: 'existing-operation',
    libraryItemId: 'existing-book',
    status: 'READY',
    privateText: 'never copy',
  });
  await refuseConversionAdmission(
    prisma,
    {
      conversionId: 'conversion-new',
      ownerId: 'owner',
      requestAttemptId: 'attempt',
    },
    error,
  );
  expect(tx.pdfConversionCost.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { conversionId: 'conversion-new' } }),
  );
  expect(admissionRefusalResponse(error, 'conversion-new')).toEqual({
    code: 'PDF_ALREADY_IMPORTED',
    message: 'PDF import was not accepted.',
    investigationId: 'conversion-new',
    operationId: 'existing-operation',
    libraryItemId: 'existing-book',
    status: 'READY',
  });
});
it('cost pages bind to conversion and projection watermark; late settlement requires restarting pages', () => {
  const watermark = 'a'.repeat(64),
    cursor = costCursor('conversion', watermark, 50);
  expect(costPage('conversion', watermark, cursor)).toEqual({
    offset: 50,
    limit: 50,
  });
  expect(() => costPage('other', watermark, cursor)).toThrow();
  expect(() => costPage('conversion', 'b'.repeat(64), cursor)).toThrow(
    'Cost projection changed',
  );
});

function admissionFixture(operationKey: string | null = null) {
  const row = {
    id: 'retained-conversion',
    ownerId: 'owner',
    operationKey,
    status: operationKey ? 'READY' : 'REFUSED',
    stage: 'ADMISSION',
    nextSequence: 0,
    activeAdmissionCount: 0,
  };
  const events = new Map<string, Record<string, unknown>>();
  const costs: Record<string, unknown>[] = [];
  const tx = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
    pdfImportOperation: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfConversionInvestigation: {
      findUnique: jest.fn().mockResolvedValue(row),
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(data)) {
          const increment =
            value && typeof value === 'object' && 'increment' in value
              ? (value as { increment: number }).increment
              : null;
          (row as unknown as Record<string, unknown>)[key] =
            increment === null
              ? value
              : Number((row as unknown as Record<string, unknown>)[key]) +
                increment;
        }
        return Promise.resolve({ ...row });
      }),
    },
    pdfConversionEvent: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { conversionId_producerKey: { producerKey: string } };
        }) =>
          Promise.resolve(
            events.get(where.conversionId_producerKey.producerKey) ?? null,
          ),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        events.set(String(data.producerKey), data);
        return Promise.resolve(data);
      }),
    },
    pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    pdfConversionCost: {
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) => {
        costs.push(create);
        return Promise.resolve(create);
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (value: typeof tx) => unknown) =>
      Promise.resolve(work(tx)),
    ),
  } as unknown as PrismaService;
  return { prisma, tx, row, events, costs };
}

it('retries a transient pre-job refusal as provisional and does not finalize while another same-key admission is active', async () => {
  const fixture = admissionFixture();
  const first = await beginConversionAdmission(
    fixture.prisma,
    'owner',
    'same-request-key-123',
  );
  expect(fixture.row).toMatchObject({
    status: 'ADMISSION',
    activeAdmissionCount: 1,
  });
  expect(fixture.costs.at(-1)).toMatchObject({
    state: 'PROVISIONAL',
    knownActualNano: 0n,
  });
  const second = await beginConversionAdmission(
    fixture.prisma,
    'owner',
    'same-request-key-123',
  );
  expect(second.conversionId).toBe(first.conversionId);
  await refuseConversionAdmission(
    fixture.prisma,
    first,
    new UnprocessableEntityException({ code: 'PDF_CAPACITY' }),
  );
  expect(fixture.row).toMatchObject({
    status: 'ADMISSION',
    activeAdmissionCount: 1,
  });
  expect(fixture.costs.at(-1)).toMatchObject({ state: 'PROVISIONAL' });
  await refuseConversionAdmission(
    fixture.prisma,
    first,
    new UnprocessableEntityException({ code: 'PDF_CAPACITY' }),
  );
  expect(fixture.row.activeAdmissionCount).toBe(1);
  await expect(
    refuseConversionAdmission(
      fixture.prisma,
      first,
      new UnprocessableEntityException({ code: 'PDF_DIFFERENT' }),
    ),
  ).rejects.toThrow('PDF_REPORT_EVENT_CONFLICT');
  await refuseConversionAdmission(
    fixture.prisma,
    second,
    new UnprocessableEntityException({ code: 'PDF_CAPACITY' }),
  );
  expect(fixture.row).toMatchObject({
    status: 'REFUSED',
    activeAdmissionCount: 0,
  });
  expect(fixture.costs.at(-1)).toMatchObject({
    state: 'FINAL',
    knownActualNano: 0n,
  });
});

it('retained trace blocks reopening after operation and receipt purge, while recording the new refusal and preserving prior costs', async () => {
  const fixture = admissionFixture('purged-operation');
  await expect(
    beginConversionAdmission(fixture.prisma, 'owner', 'same-request-key-123'),
  ).rejects.toMatchObject({
    response: {
      code: 'PDF_IMPORT_REMOVED',
      investigationId: 'retained-conversion',
    },
  });
  expect(fixture.row).toMatchObject({
    status: 'READY',
    operationKey: 'purged-operation',
    activeAdmissionCount: 0,
  });
  expect([...fixture.events.values()]).toEqual([
    expect.objectContaining({
      conversionId: 'retained-conversion',
      kind: 'ADMISSION_REFUSED',
      code: 'PDF_IMPORT_REMOVED',
    }),
  ]);
  expect(fixture.tx.pdfConversionCost.upsert).not.toHaveBeenCalled();
});
