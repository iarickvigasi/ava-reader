import type { PrismaService } from '../../../prisma/prisma.service';
import type { Tx } from '../jobs/types';
import { reservePdfProvider } from './reserve';
import { dispatchPdfProvider } from './dispatch';
import { loadProviderGrant } from './load-grant';
import { allocateProviderBudgets } from './allocate';
import { loadProviderReceipt } from './load-receipt';
import { markPdfProviderUncertain } from './uncertain';
import { storeProviderPayload } from './payload';
import { route } from './test-fixtures';
import { jsonHash } from './hash';
import { prepareFigure } from './figure-alt-fixture';
import { checksumBuffer } from '../../../shared/blob-utils';
const mockCalls = new Map<string, Record<string, unknown>>();
const mockCreate = jest.fn((query: { data: Record<string, unknown> }) => {
  const call = { id: 'owned-call', state: 'RESERVED', ...query.data };
  mockCalls.set(query.data.taskId as string, call);
  return Promise.resolve(call);
});
const mockTx = {
  pdfProviderCall: {
    findUnique: jest.fn(
      (query: { where: { grantId_taskId: { taskId: string } } }) =>
        Promise.resolve(mockCalls.get(query.where.grantId_taskId.taskId)),
    ),
    count: jest.fn(() => Promise.resolve(mockCalls.size)),
    create: mockCreate,
  },
} as unknown as Tx;
jest.mock('../jobs/transaction', () => ({
  jobTransaction: (_: unknown, callback: (tx: Tx) => unknown) =>
    callback(mockTx),
}));
jest.mock('./load-grant', () => ({ loadProviderGrant: jest.fn() }));
jest.mock('./cost-lock', () => ({ costLock: jest.fn() }));
jest.mock('./recover-dispatch', () => ({
  fenceAbandonedProviderDispatch: jest.fn(),
}));
jest.mock('./allocate', () => ({ allocateProviderBudgets: jest.fn() }));
jest.mock('../reports/provider-event', () => ({
  recordPdfProviderEvent: jest.fn(),
}));
jest.mock('./load-receipt', () => ({ loadProviderReceipt: jest.fn() }));
jest.mock('./uncertain', () => ({ markPdfProviderUncertain: jest.fn() }));
jest.mock('./payload', () => ({ storeProviderPayload: jest.fn() }));
const authority = {
  principalId: 'owned-principal',
  token: 'synthetic',
  attemptId: 'owned-attempt',
  attemptToken: 'synthetic',
};
const prisma = {} as PrismaService;

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.clear();
  const task = prepareFigure().task;
  jest.mocked(loadProviderGrant).mockResolvedValue({
    grant: {
      id: 'owned-grant',
      ownerId: 'owned-user',
      budgetIds: ['budget'],
      route: {
        ...route,
        configuration: {
          ...(route.configuration as object),
          promptHashes: {
            [task.promptVersion]: checksumBuffer(
              Buffer.from(task.messages[0].content as string),
            ),
          },
          schemaHashes: { [task.schemaVersion]: jsonHash(task.responseSchema) },
        },
      },
    },
    job: {
      source: { sha256: task.sourceSha256 },
      source_page_limit: 500,
      operation_id: 'owned-operation',
    },
    attempt: {
      id: authority.attemptId,
      job: { operation: { stage: 'EXTRACTION' } },
    },
  } as unknown as Awaited<ReturnType<typeof loadProviderGrant>>);
});
it('reuses the exact derived child reservation and settled receipt without another allocation or send', async () => {
  const first = await reservePdfProvider(
    prisma,
    authority,
    prepareFigure().task,
  );
  first.call.state = 'SETTLED';
  const second = await reservePdfProvider(
    prisma,
    authority,
    prepareFigure().task,
  );
  expect(second.call).toBe(first.call);
  jest
    .mocked(loadProviderReceipt)
    .mockResolvedValue({ output: 'retained-child', reused: true } as Awaited<
      ReturnType<typeof loadProviderReceipt>
    >);
  const transport = jest.fn();
  expect(
    await dispatchPdfProvider(
      prisma,
      { task: prepareFigure().task, authority },
      transport,
    ),
  ).toMatchObject({ output: 'retained-child', reused: true });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
  expect(transport).not.toHaveBeenCalled();
});
it('refuses changed child request content under the same ledger identity without another allocation', async () => {
  const task = prepareFigure().task;
  await reservePdfProvider(prisma, authority, task);
  const changed = structuredClone(task),
    content = changed.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw Error('fixture');
  content[0].text += 'changed';
  await expect(reservePdfProvider(prisma, authority, changed)).rejects.toThrow(
    'PDF_PROVIDER_REQUEST_CONFLICT',
  );
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
});
it('does not turn an uncertain child into another opportunity', async () => {
  const task = prepareFigure().task;
  const first = await reservePdfProvider(prisma, authority, task);
  first.call.state = 'UNCERTAIN';
  const transport = jest.fn();
  await expect(
    dispatchPdfProvider(prisma, { task, authority }, transport),
  ).rejects.toThrow('PDF_PROVIDER_OUTCOME_UNCERTAIN');
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
  expect(markPdfProviderUncertain).toHaveBeenCalledTimes(1);
  expect(storeProviderPayload).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});
