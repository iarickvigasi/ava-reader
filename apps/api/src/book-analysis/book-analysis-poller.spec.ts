import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { OpenRouterClient } from '../shared/openrouter-client';
import { BookAnalysisService } from './book-analysis.service';

describe('book analysis scheduled failure boundary', () => {
  const originalEnvironment = process.env.NODE_ENV;
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  });

  it('contains an asynchronous queue rejection and polls again without touching a book', async () => {
    const error = Object.assign(
      new Error('postgresql://private:secret@host/book text'),
      {
        code: 'P1001',
      },
    );
    const lookup = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(null);
    const claim = jest.fn();
    const update = jest.fn();
    const model = jest.fn();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const prisma = {
      bookProcessingRun: { findFirst: lookup, updateMany: claim, update },
    } as unknown as PrismaService;
    const openrouter = { getModel: model } as unknown as OpenRouterClient;
    const service = new BookAnalysisService(prisma, openrouter);
    service.onModuleInit();
    try {
      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'Book background analysis unavailable (P1001); checking again on the next poll.',
      );
      await jest.advanceTimersByTimeAsync(2000);
      expect(lookup).toHaveBeenCalledTimes(2);
      expect(claim).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(model).not.toHaveBeenCalled();
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private');
    } finally {
      service.onModuleDestroy();
    }
  });
});
