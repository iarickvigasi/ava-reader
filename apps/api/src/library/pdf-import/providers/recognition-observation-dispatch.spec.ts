import type { PrismaService } from '../../../prisma/prisma.service';
import { dispatchPdfProvider } from './dispatch';
import { reservePdfProvider } from './reserve';
import { loadProviderReceipt } from './load-receipt';
import { markPdfProviderUncertain } from './uncertain';
import { settlePdfProvider } from './settle';
import { storeProviderPayload } from './payload';
import { prepareProviderRequest } from './prepare-request';
import {
  observationRoute,
  observationTask,
  observationResponse,
} from './recognition-observation-fixture';
jest.mock('./reserve', () => ({ reservePdfProvider: jest.fn() }));
jest.mock('./load-receipt', () => ({ loadProviderReceipt: jest.fn() }));
jest.mock('./uncertain', () => ({ markPdfProviderUncertain: jest.fn() }));
jest.mock('./settle', () => ({ settlePdfProvider: jest.fn() }));
jest.mock('./payload', () => ({ storeProviderPayload: jest.fn() }));
jest.mock('./begin-dispatch', () => ({ beginPdfDispatch: jest.fn() }));
const authority = {
  principalId: 'principal',
  token: 'synthetic',
  attemptId: 'attempt',
  attemptToken: 'synthetic',
};
const prisma = {
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner' }) },
} as unknown as PrismaService;
const prepared = prepareProviderRequest(observationRoute, observationTask);
const wire = JSON.stringify(observationResponse),
  raw = Buffer.from('raw-private-envelope');
const transport = jest.fn().mockResolvedValue(raw);
const dispatch = () =>
  dispatchPdfProvider(prisma, { task: observationTask, authority }, transport);
const previousHooks = process.env.AVA_PDF_TEST_HOOKS;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadProviderReceipt).mockResolvedValue({
    output: wire,
    reused: true,
    callId: 'call',
    generationId: 'generation',
    actualNano: '17',
  });
  process.env.AVA_PDF_TEST_HOOKS = '1';
});
afterEach(() => {
  if (previousHooks === undefined) delete process.env.AVA_PDF_TEST_HOOKS;
  else process.env.AVA_PDF_TEST_HOOKS = previousHooks;
});
function reserve(state: 'SETTLED' | 'RESERVED') {
  jest.mocked(reservePdfProvider).mockResolvedValue({
    call: { id: 'call', state },
    prepared,
    grant: { ownerId: 'owner', route: { mode: 'stub' } },
  } as Awaited<ReturnType<typeof reservePdfProvider>>);
}
it('decodes fresh and exact reused receipts identically while preserving raw bytes and cost', async () => {
  reserve('RESERVED');
  const fresh = await dispatch();
  reserve('SETTLED');
  const reused = await dispatch();
  expect(fresh).toEqual({ ...reused, reused: false });
  expect(fresh).toMatchObject({ actualNano: '17', callId: 'call' });
  expect(JSON.parse(fresh.output) as unknown).toMatchObject({
    schema_version: 'ava-recognition-response-2',
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(settlePdfProvider).toHaveBeenCalledTimes(1);
  expect(storeProviderPayload).toHaveBeenCalledWith(
    prisma,
    'owner',
    'call',
    'RESPONSE',
    raw,
  );
  expect(markPdfProviderUncertain).not.toHaveBeenCalled();
});
it('refuses malformed settled wire after known settlement without uncertainty or another send', async () => {
  reserve('RESERVED');
  jest
    .mocked(loadProviderReceipt)
    .mockResolvedValue({ output: '{}', reused: true } as Awaited<
      ReturnType<typeof loadProviderReceipt>
    >);
  await expect(dispatch()).rejects.toThrow('PDF_PROVIDER_OUTPUT_INVALID');
  expect(settlePdfProvider).toHaveBeenCalledTimes(1);
  expect(storeProviderPayload).toHaveBeenCalledWith(
    prisma,
    'owner',
    'call',
    'RESPONSE',
    raw,
  );
  expect(markPdfProviderUncertain).not.toHaveBeenCalled();
  expect(transport).toHaveBeenCalledTimes(1);
});
