import type { PrismaService } from '../../../prisma/prisma.service';
import { dispatchPdfProvider } from './dispatch';
import { markPdfProviderUncertain } from './uncertain';
import { preserveUnconfirmedReceipt } from './unconfirmed-receipt';
import { settlePdfProvider } from './settle';
import { ProviderTransportFailure } from './transport-failure';
import { task } from './test-fixtures';
jest.mock('./reserve', () => ({
  reservePdfProvider: jest.fn().mockResolvedValue({
    call: { id: 'call', state: 'RESERVED' },
    prepared: {
      request: Buffer.from('{}'),
      config: { timeoutMs: 300000, maxResponseBytes: 1024 },
    },
    grant: { ownerId: 'owner', route: { mode: 'stub' } },
  }),
}));
jest.mock('./payload', () => ({ storeProviderPayload: jest.fn() }));
jest.mock('./begin-dispatch', () => ({ beginPdfDispatch: jest.fn() }));
jest.mock('./settle', () => ({ settlePdfProvider: jest.fn() }));
jest.mock('./uncertain', () => ({ markPdfProviderUncertain: jest.fn() }));
jest.mock('./unconfirmed-receipt', () => ({
  preserveUnconfirmedReceipt: jest.fn(),
}));
it('preserves private HTTP evidence only after marking the reservation uncertain', async () => {
  const previous = process.env.AVA_PDF_TEST_HOOKS;
  process.env.AVA_PDF_TEST_HOOKS = '1';
  try {
    const prisma = {} as PrismaService;
    const receipt = Buffer.from('{"status":400,"body":"unsupported anyOf"}');
    const transport = jest.fn(() =>
      Promise.reject(new ProviderTransportFailure(receipt)),
    );
    await expect(
      dispatchPdfProvider(
        prisma,
        {
          task,
          authority: {
            principalId: 'principal',
            token: 'synthetic',
            attemptId: 'attempt',
            attemptToken: 'synthetic',
          },
        },
        transport,
      ),
    ).rejects.toThrow('PDF_PROVIDER_OUTCOME_UNCERTAIN');
    expect(markPdfProviderUncertain).toHaveBeenCalledWith(prisma, 'call');
    expect(preserveUnconfirmedReceipt).toHaveBeenCalledWith(
      prisma,
      'owner',
      'call',
      receipt,
    );
    expect(
      jest.mocked(markPdfProviderUncertain).mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(preserveUnconfirmedReceipt).mock.invocationCallOrder[0],
    );
    expect(settlePdfProvider).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    if (previous === undefined) delete process.env.AVA_PDF_TEST_HOOKS;
    else process.env.AVA_PDF_TEST_HOOKS = previous;
  }
});

it('persists known HTTP rate-limit classification without settlement or a second send', async () => {
  const previous = process.env.AVA_PDF_TEST_HOOKS;
  process.env.AVA_PDF_TEST_HOOKS = '1';
  jest.clearAllMocks();
  try {
    const diagnostic = {
      httpStatus: 429,
      complete: true,
      classification: 'RATE_LIMIT' as const,
      limitSource: 'upstream_provider_shared_pool',
      retryAfterSeconds: 60,
    };
    const receipt = Buffer.from('{"status":429,"body":"private detail"}');
    const transport = jest.fn(() =>
      Promise.reject(new ProviderTransportFailure(receipt, diagnostic)),
    );
    await expect(
      dispatchPdfProvider(
        {} as PrismaService,
        {
          task,
          authority: {
            principalId: 'principal',
            token: 'synthetic',
            attemptId: 'attempt',
            attemptToken: 'synthetic',
          },
        },
        transport,
      ),
    ).rejects.toThrow('PDF_PROVIDER_OUTCOME_UNCERTAIN');
    expect(markPdfProviderUncertain).toHaveBeenCalledWith(
      expect.anything(),
      'call',
      diagnostic,
    );
    expect(settlePdfProvider).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    if (previous === undefined) delete process.env.AVA_PDF_TEST_HOOKS;
    else process.env.AVA_PDF_TEST_HOOKS = previous;
  }
});
