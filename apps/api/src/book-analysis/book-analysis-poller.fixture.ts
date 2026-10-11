import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { OpenRouterClient } from '../shared/openrouter-client';
import { BookAnalysisService } from './book-analysis.service';

export function pollerFixture() {
  const lookup = jest.fn().mockResolvedValue(null);
  const claim = jest.fn().mockResolvedValue({ count: 1 });
  const update = jest
    .fn<Promise<unknown>, [Prisma.BookProcessingRunUpdateArgs]>()
    .mockResolvedValue({});
  const model = jest.fn().mockReturnValue({});
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  const prisma = {
    bookProcessingRun: { findFirst: lookup, updateMany: claim, update },
    bookFile: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  const openrouter = {
    getModel: model,
    getModelId: jest.fn().mockReturnValue('test-model'),
  } as unknown as OpenRouterClient;
  return {
    lookup,
    claim,
    update,
    model,
    warn,
    service: new BookAnalysisService(prisma, openrouter),
  };
}

export function productionPollerTimers() {
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
}
