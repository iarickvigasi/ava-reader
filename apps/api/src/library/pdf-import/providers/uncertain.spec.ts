import type { PrismaService } from '../../../prisma/prisma.service';
import { markPdfProviderUncertain } from './uncertain';
// Ledger isolation stays here; real report-mirror failure has a separate seam.
jest.mock('../reports/provider-event', () => ({
  recordPdfProviderEvent: (
    tx: { pdfProviderEvent: { create: (input: unknown) => unknown } },
    input: unknown,
  ) => tx.pdfProviderEvent.create(input),
}));
const mockTx = {
  pdfProviderCall: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  pdfProviderEvent: { create: jest.fn() },
  pdfProviderRoute: { updateMany: jest.fn() },
  pdfProviderBudget: { update: jest.fn() },
  pdfProviderAllocation: { update: jest.fn() },
};
jest.mock('./cost-lock', () => ({
  costTransaction: jest.fn((_prisma: unknown, work: (tx: unknown) => unknown) =>
    work(mockTx),
  ),
}));

describe('known HTTP failure still keeps unknown charge reserved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.pdfProviderCall.findUniqueOrThrow.mockResolvedValue({
      id: 'call',
      state: 'DISPATCHING',
      requestSha256: 'request-hash',
      grant: { routeId: 'route' },
    });
  });
  it('persists machine classification while pausing and preserving every allocation', async () => {
    const diagnostic = {
      httpStatus: 429,
      complete: true,
      classification: 'RATE_LIMIT' as const,
      limitSource: 'upstream_provider_shared_pool',
      retryAfterSeconds: 60,
    };
    await markPdfProviderUncertain({} as PrismaService, 'call', diagnostic);
    expect(mockTx.pdfProviderCall.update).toHaveBeenCalledWith({
      where: { id: 'call' },
      data: { state: 'UNCERTAIN', failureCode: 'HTTP_429' },
    });
    expect(mockTx.pdfProviderEvent.create).toHaveBeenCalledWith({
      data: {
        callId: 'call',
        kind: 'OUTCOME_UNKNOWN',
        evidenceSha256: 'request-hash',
        details: { transport: diagnostic },
      },
    });
    expect(mockTx.pdfProviderRoute.updateMany).toHaveBeenCalledWith({
      where: { id: 'route', state: 'ACTIVE' },
      data: { state: 'PAUSED_UNCERTAIN' },
    });
    expect(mockTx.pdfProviderBudget.update).not.toHaveBeenCalled();
    expect(mockTx.pdfProviderAllocation.update).not.toHaveBeenCalled();
  });
  it('does not rewrite a previously unknown outcome from later diagnostics', async () => {
    mockTx.pdfProviderCall.findUniqueOrThrow.mockResolvedValue({
      id: 'call',
      state: 'UNCERTAIN',
      grant: { routeId: 'route' },
    });
    await markPdfProviderUncertain({} as PrismaService, 'call', {
      httpStatus: 429,
      complete: true,
      classification: 'RATE_LIMIT',
    });
    expect(mockTx.pdfProviderCall.update).not.toHaveBeenCalled();
    expect(mockTx.pdfProviderEvent.create).not.toHaveBeenCalled();
    expect(mockTx.pdfProviderBudget.update).not.toHaveBeenCalled();
  });
});
