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
import {
  anchorParent,
  anchorOriginal,
  anchorTask,
} from '../../../pdf-conversion/reconstruction/anchor-context-fixture';
import { anchorContextProviderTask } from '../../../pdf-conversion/reconstruction/anchor-context-provider-task';
import {
  contextSha,
  contextTaskId,
} from '../../../pdf-conversion/reconstruction/anchor-context-binding';

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
  const task = anchorContextProviderTask(
    anchorTask,
    anchorParent,
    anchorOriginal,
  );
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
            [task.promptVersion]: contextSha(
              task.messages[0].content as string,
            ),
          },
          schemaHashes: { [task.schemaVersion]: jsonHash(task.responseSchema) },
        },
      },
    },
    job: {
      source: { sha256: anchorParent.source_sha256 },
      source_page_limit: 500,
      operation_id: 'owned-operation',
    },
    attempt: {
      id: authority.attemptId,
      job: { operation: { stage: 'EXTRACTION' } },
    },
  } as unknown as Awaited<ReturnType<typeof loadProviderGrant>>);
});

it('reuses the exact parent receipt without reserving twice', async () => {
  const task = anchorContextProviderTask(
    anchorTask,
    anchorParent,
    anchorOriginal,
  );
  const first = await reservePdfProvider(prisma, authority, task);
  first.call.state = 'SETTLED';
  jest
    .mocked(loadProviderReceipt)
    .mockResolvedValue({ output: 'retained-output', reused: true } as Awaited<
      ReturnType<typeof loadProviderReceipt>
    >);
  const transport = jest.fn();
  expect(
    await dispatchPdfProvider(prisma, { task, authority }, transport),
  ).toMatchObject({ output: 'retained-output', reused: true });
  expect(mockCalls.size).toBe(1);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
  expect(transport).not.toHaveBeenCalled();
});

it.each(['response-json', 'span-json'])(
  'refuses renewed equivalent %s content at the stable parent ledger key',
  async (kind) => {
    const firstTask = anchorContextProviderTask(
      anchorTask,
      anchorParent,
      anchorOriginal,
    );
    await reservePdfProvider(prisma, authority, firstTask);
    const changed = structuredClone(anchorTask);
    if (kind === 'response-json') {
      changed.original_response_json = JSON.stringify(
        JSON.parse(changed.original_response_json),
        null,
        2,
      );
      changed.original_response_sha256 = contextSha(
        changed.original_response_json,
      );
    } else {
      changed.slots[0].original_span_json = JSON.stringify(
        JSON.parse(changed.slots[0].original_span_json),
        null,
        2,
      );
      changed.slots[0].span_sha256 = contextSha(
        changed.slots[0].original_span_json,
      );
    }
    changed.task_id = contextTaskId(changed);
    const variant = anchorContextProviderTask(
      changed,
      anchorParent,
      anchorOriginal,
    );
    expect(variant.taskId).toBe(firstTask.taskId);
    expect(changed.task_id).not.toBe(anchorTask.task_id);
    await expect(
      reservePdfProvider(prisma, authority, variant),
    ).rejects.toThrow('PDF_PROVIDER_REQUEST_CONFLICT');
    expect(mockCalls.size).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
  },
);

it('never sends again when the existing parent correction is uncertain', async () => {
  const task = anchorContextProviderTask(
    anchorTask,
    anchorParent,
    anchorOriginal,
  );
  const reserved = await reservePdfProvider(prisma, authority, task);
  reserved.call.state = 'UNCERTAIN';
  const transport = jest.fn();
  await expect(
    dispatchPdfProvider(prisma, { task, authority }, transport),
  ).rejects.toThrow('PDF_PROVIDER_OUTCOME_UNCERTAIN');
  expect(markPdfProviderUncertain).toHaveBeenCalledWith(
    prisma,
    reserved.call.id,
  );
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
  expect(storeProviderPayload).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});

it('refuses changed corrective request content rather than allocating another parent request', async () => {
  const task = anchorContextProviderTask(
    anchorTask,
    anchorParent,
    anchorOriginal,
  );
  await reservePdfProvider(prisma, authority, task);
  const changed = {
    ...task,
    messages: [
      ...task.messages,
      { role: 'user' as const, content: 'Different correction instruction' },
    ],
  };
  await expect(reservePdfProvider(prisma, authority, changed)).rejects.toThrow(
    'PDF_PROVIDER_REQUEST_CONFLICT',
  );
  expect(mockCalls.size).toBe(1);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(allocateProviderBudgets).toHaveBeenCalledTimes(1);
});
