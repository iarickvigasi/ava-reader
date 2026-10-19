import { settlePdfProvider } from './settle';
import { recordPdfProviderEvent } from '../reports/provider-event';
import { config, route, task, response } from './test-fixtures';
import { prepareProviderRequest } from './prepare-request';
import { checksumBuffer } from '../../../shared/blob-utils';
import type { PrismaService } from '../../../prisma/prisma.service';
jest.mock('./cost-lock', () => ({
  costTransaction: jest.fn((p, run) => (run as (tx: unknown) => unknown)(p)),
}));
jest.mock('../jobs/transaction', () => ({
  databaseNow: jest.fn(() => Promise.resolve(new Date('2026-10-18T00:00:00Z'))),
}));
jest.mock('../reports/provider-event', () => ({
  recordPdfProviderEvent: jest.fn(() => Promise.resolve({})),
}));
function setup(mapped = true) {
  const configuration = mapped
    ? { ...config, maxOutputTokensByPrompt: { [task.promptVersion]: 16384 } }
    : config;
  const request = prepareProviderRequest(
    { ...route, configuration },
    { ...task, maxOutputTokens: 3072 },
  ).request;
  const checksum = checksumBuffer(request);
  const call = {
    id: 'call',
    state: 'DISPATCHING',
    failureCode: null as string | null,
    actualNano: null as bigint | null,
    providerGenerationId: null as string | null,
    receiptSha256: null as string | null,
    promptVersion: task.promptVersion,
    requestSha256: checksum,
    reservedNano: 100000000n,
    grant: {
      ownerId: 'owner',
      routeId: 'route',
      route: { ...route, configuration },
    },
    allocations: [0, 1, 2, 3].map((i) => ({
      id: 'allocation' + i,
      budgetId: 'budget' + i,
      reservedNano: 100000000n,
    })),
    payloads: [
      {
        callId: 'call',
        ownerId: 'owner',
        kind: 'REQUEST',
        checksum,
        sizeBytes: request.length,
        blob: { bytes: request, checksum, sizeBytes: request.length },
      },
    ],
  };
  const tx = {
    pdfProviderCall: {
      findUniqueOrThrow: jest.fn(() => Promise.resolve(call)),
      update: jest.fn(({ data }: { data: Partial<typeof call> }) =>
        Promise.resolve(Object.assign(call, data)),
      ),
    },
    pdfProviderBudget: { update: jest.fn() },
    pdfProviderAllocation: { update: jest.fn() },
    pdfProviderRoute: { update: jest.fn() },
  };
  return { call, tx, db: tx as unknown as PrismaService };
}
const receipt = (tokens: number, finish = 'stop') =>
  response('0.001', {
    usage: { cost: '0.001', prompt_tokens: 100, completion_tokens: tokens },
    choices: [
      { finish_reason: finish, message: { content: '{"text":"read"}' } },
    ],
  });
beforeEach(() => jest.clearAllMocks());
it('settles actual money but pauses for completion beyond the exact smaller dispatched cap', async () => {
  const x = setup();
  const r = await settlePdfProvider(x.db, 'call', receipt(3073));
  expect(r.overage).toBe(true);
  expect(x.call.actualNano).toBe(1000000n);
  expect(x.call.state).toBe('SETTLED');
  expect(x.call.failureCode).toBe('PROVIDER_BOUND_EXCEEDED');
  expect(x.tx.pdfProviderBudget.update).toHaveBeenCalledTimes(4);
  expect(x.tx.pdfProviderRoute.update).toHaveBeenCalledWith({
    where: { id: 'route' },
    data: { state: 'PAUSED_OVERAGE' },
  });
});
it.each(['missing', 'corrupt'])(
  'keeps known money settled and prevents output reuse for %s request proof',
  async (fault) => {
    const x = setup();
    if (fault === 'missing') x.call.payloads = [];
    else x.call.payloads[0].checksum = '0'.repeat(64);
    const bytes = receipt(10);
    const r = await settlePdfProvider(x.db, 'call', bytes);
    expect(r.boundUnverified).toBe(true);
    expect(x.call.actualNano).toBe(1000000n);
    expect(x.call.failureCode).toBe('PROVIDER_OUTPUT_BOUND_UNVERIFIED');
    expect(x.tx.pdfProviderBudget.update).toHaveBeenCalledTimes(4);
    expect(jest.mocked(recordPdfProviderEvent).mock.calls[0][0]).toBe(x.tx);
    expect(jest.mocked(recordPdfProviderEvent).mock.calls[0][1].data.kind).toBe(
      'BOUND_UNVERIFIED',
    );
    const again = await settlePdfProvider(x.db, 'call', bytes);
    expect(again.boundUnverified).toBe(true);
    expect(x.tx.pdfProviderBudget.update).toHaveBeenCalledTimes(4);
  },
);
it('preserves legacy missing-payload settlement with its explicit route fallback', async () => {
  const x = setup(false);
  x.call.payloads = [];
  const r = await settlePdfProvider(x.db, 'call', receipt(10));
  expect(r.boundUnverified).toBe(false);
  expect(r.overage).toBe(false);
  expect(x.call.failureCode).toBeNull();
});
it('settles an incomplete but independently billed response without treating it as unknown money', async () => {
  const x = setup();
  const r = await settlePdfProvider(x.db, 'call', receipt(10, 'length'));
  expect(r.complete).toBe(false);
  expect(x.call.actualNano).toBe(1000000n);
  expect(x.call.state).toBe('SETTLED');
  expect(x.tx.pdfProviderBudget.update).toHaveBeenCalledTimes(4);
});
