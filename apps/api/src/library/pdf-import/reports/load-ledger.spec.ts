import type { Tx } from '../jobs/types';
import { loadConversionProjection } from './load-ledger';

it('keeps the exact full-book total beyond 1000 calls instead of rejecting or truncating allowed history', async () => {
  const route = {
    modelId: 'model',
    providerSlug: 'provider',
    tariffSha256: 'a'.repeat(64),
    configurationSha256: 'b'.repeat(64),
  };
  const calls = Array.from({ length: 1001 }, (_, index) => ({
    id: `call-${String(index).padStart(4, '0')}`,
    state: 'SETTLED',
    reservedNano: 10n,
    actualNano: 3n,
    requestSha256: 'c'.repeat(64),
    receiptSha256: 'd'.repeat(64),
    providerGenerationId: `gen-${index}`,
    events: [],
  }));
  const tx = {
    pdfProviderGrant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'grant', routeId: 'route', route }),
    },
    pdfProviderCall: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(calls.slice(0, 250))
        .mockResolvedValueOnce(calls.slice(250, 500))
        .mockResolvedValueOnce(calls.slice(500, 750))
        .mockResolvedValueOnce(calls.slice(750, 1000))
        .mockResolvedValueOnce(calls.slice(1000)),
    },
  };
  const result = await loadConversionProjection(
    tx as unknown as Tx,
    'operation',
    true,
    { offset: 1000, limit: 50 },
  );
  expect(result).toMatchObject({
    knownActualNano: '3003',
    callCount: 1001,
    state: 'FINAL',
  });
  expect(result.calls).toHaveLength(1);
  expect(tx.pdfProviderCall.findMany).toHaveBeenCalledTimes(5);
  expect(tx.pdfProviderCall.findMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      take: 250,
      where: { grantId: 'grant', id: { gt: 'call-0999' } },
    }),
  );
});

it('keeps known charges but leaves a non-string historical purpose unknown instead of coercing an array into an authorized purpose', async () => {
  const tx = {
    pdfProviderGrant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'grant',
        routeId: 'route',
        route: {
          modelId: 'model',
          providerSlug: 'provider',
          tariffSha256: 'a'.repeat(64),
          configurationSha256: 'b'.repeat(64),
        },
      }),
    },
    pdfProviderCall: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'call-one',
          state: 'SETTLED',
          reservedNano: 10n,
          actualNano: 3n,
          requestSha256: 'c'.repeat(64),
          receiptSha256: 'd'.repeat(64),
          providerGenerationId: 'gen-one',
          events: [
            { kind: 'RESERVED', details: { purpose: ['resolve_structure'] } },
          ],
        },
      ]),
    },
  };
  const result = await loadConversionProjection(
    tx as unknown as Tx,
    'operation',
    true,
    { offset: 0, limit: 50 },
  );
  expect(result).toMatchObject({
    knownActualNano: '3',
    callCount: 1,
    state: 'FINAL',
    calls: [expect.objectContaining({ purpose: null })],
  });
});
