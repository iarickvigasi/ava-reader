import type { Tx } from '../jobs/types';
import { recordPdfProviderEvent } from './provider-event';
it('preserves the authoritative settled event when the report-event sink fails', async () => {
  const event = {
    id: 'receipt-event',
    callId: 'call',
    kind: 'SETTLED',
    createdAt: new Date(),
    details: {},
  };
  const tx = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    pdfProviderEvent: { create: jest.fn().mockResolvedValue(event) },
    pdfProviderCall: {
      findUniqueOrThrow: jest
        .fn()
        .mockRejectedValue(new Error('mirror sink unavailable')),
    },
  };
  expect(
    await recordPdfProviderEvent(tx as unknown as Tx, {
      data: {
        callId: 'call',
        kind: 'SETTLED',
        evidenceSha256: 'a'.repeat(64),
        details: {},
      },
    }),
  ).toBe(event);
  expect(tx.pdfProviderEvent.create).toHaveBeenCalledTimes(1);
  expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
    'ROLLBACK TO SAVEPOINT ava_pdf_report_mirror',
  );
});

it.each(['RESERVED', 'DISPATCH_INTENT', 'SETTLED'])(
  'mirrors a real endpoint %s ledger event without rolling back the optional report or losing settled totals',
  async (kind) => {
    const now = new Date('2026-10-12T16:36:04.184Z');
    const event = {
      id: `ledger-${kind}`,
      callId: 'call-one',
      kind,
      createdAt: now,
      details: { purpose: 'transcribe_region', pageIndices: [0] },
    };
    const route = {
      id: 'route-one',
      modelId: 'google/gemini-3.8-flash',
      providerSlug: 'google-vertex/global',
      configurationSha256: 'b'.repeat(64),
      tariffSha256: 'c'.repeat(64),
    };
    const grant = {
      id: 'grant-one',
      ownerId: 'owner-one',
      operationKey: 'operation-one',
      routeId: route.id,
      route,
    };
    const record = {
      id: 'operation-one',
      operationKey: 'operation-one',
      status: 'FAILED',
      coverage: 'API_LIFECYCLE',
      nextSequence: 1,
    };
    const amounts = [
      32013750n,
      21663750n,
      28548750n,
      15960000n,
      17857500n,
      11730000n,
      27652500n,
    ];
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([{ now }]),
      pdfProviderEvent: { create: jest.fn().mockResolvedValue(event) },
      pdfProviderCall: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: event.callId, grant }),
        findMany: jest.fn().mockResolvedValue(
          amounts.map((actualNano, index) => ({
            id: `call-${index}`,
            state: 'SETTLED',
            reservedNano: 1032192750n,
            actualNano,
            requestSha256: 'd'.repeat(64),
            receiptSha256: 'e'.repeat(64),
            providerGenerationId: `generation-${index}`,
            events: [],
          })),
        ),
      },
      pdfProviderGrant: { findUnique: jest.fn().mockResolvedValue(grant) },
      pdfConversionInvestigation: {
        findUnique: jest.fn().mockResolvedValue(record),
        findUniqueOrThrow: jest.fn().mockResolvedValue(record),
        update: jest.fn().mockResolvedValue(record),
      },
      pdfConversionEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
      },
      pdfConversionCost: {
        upsert: jest.fn(({ create }: { create: unknown }) =>
          Promise.resolve(create),
        ),
      },
    };
    await expect(
      recordPdfProviderEvent(tx as unknown as Tx, {
        data: {
          callId: event.callId,
          kind,
          evidenceSha256: 'a'.repeat(64),
          details: event.details,
        },
      }),
    ).resolves.toBe(event);
    expect(tx.pdfProviderEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalledWith(
      'ROLLBACK TO SAVEPOINT ava_pdf_report_mirror',
    );
    expect(tx.pdfConversionEvent.create.mock.calls[0][0].data).toMatchObject({
      kind:
        kind === 'RESERVED'
          ? 'PROVIDER_RESERVED'
          : kind === 'DISPATCH_INTENT'
            ? 'PROVIDER_DISPATCH'
            : 'PROVIDER_SETTLED',
      details: {
        routeSelection: {
          providerSlug: 'google-vertex/global',
          observedProvider: 'UNKNOWN',
        },
      },
    });
    expect(tx.pdfConversionCost.upsert.mock.calls[0][0].create).toMatchObject({
      knownActualNano: 155426250n,
      reservedNano: 0n,
      uncertainNano: 0n,
      callCount: 7,
      actualComplete: true,
      state: 'FINAL',
      projection: { calls: [] },
    });
  },
);
