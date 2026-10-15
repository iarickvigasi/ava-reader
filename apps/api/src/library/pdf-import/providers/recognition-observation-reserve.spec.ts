import type { PrismaService } from '../../../prisma/prisma.service';
import type { Tx } from '../jobs/types';
import { reservePdfProvider } from './reserve';
import { prepareProviderRequest } from './prepare-request';
import { allocateProviderBudgets } from './allocate';
import {
  observationRoute,
  observationTask,
} from './recognition-observation-fixture';
const mockPrevious = {
  id: 'old',
  state: 'SETTLED',
  requestSha256: 'b'.repeat(64),
  taskSha256: '',
};
const mockCreate = jest.fn();
const mockTx = {
  pdfProviderCall: {
    findUnique: jest.fn(() => mockPrevious),
    create: mockCreate,
  },
} as unknown as Tx;
jest.mock('../jobs/transaction', () => ({
  jobTransaction: (_: unknown, run: (tx: Tx) => unknown) => run(mockTx),
}));
jest.mock('./load-grant', () => ({
  loadProviderGrant: jest.fn(() => ({
    grant: { id: 'grant', route: observationRoute },
    job: {
      source: { sha256: observationTask.sourceSha256 },
      source_page_limit: 500,
    },
    attempt: { id: 'attempt' },
  })),
}));
jest.mock('./cost-lock', () => ({ costLock: jest.fn() }));
jest.mock('./recover-dispatch', () => ({
  fenceAbandonedProviderDispatch: jest.fn(),
}));
jest.mock('./allocate', () => ({ allocateProviderBudgets: jest.fn() }));
const authority = {
  principalId: 'principal',
  token: 'synthetic',
  attemptId: 'attempt',
  attemptToken: 'synthetic',
};
it('refuses a former request hash at the same canonical task instead of decoding or reserving again', async () => {
  const prepared = prepareProviderRequest(observationRoute, observationTask);
  mockPrevious.taskSha256 = prepared.taskSha256;
  await expect(
    reservePdfProvider({} as PrismaService, authority, observationTask),
  ).rejects.toThrow('PDF_PROVIDER_REQUEST_CONFLICT');
  expect(mockCreate).not.toHaveBeenCalled();
  expect(allocateProviderBudgets).not.toHaveBeenCalled();
  mockPrevious.requestSha256 = prepared.requestSha256;
  const reuse = await reservePdfProvider(
    {} as PrismaService,
    authority,
    observationTask,
  );
  expect(reuse.call).toBe(mockPrevious);
  expect(reuse.prepared.requestSha256).toBe(prepared.requestSha256);
  expect(mockCreate).not.toHaveBeenCalled();
});
