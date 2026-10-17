import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { processCanonicalEpubOnce } from '../library/epub-import/process-once';
import { ReaderProcessingService } from './reader-processing.service';

jest.mock('../library/epub-import/process-once', () => ({
  processCanonicalEpubOnce: jest.fn(),
}));
const prepare = jest.mocked(processCanonicalEpubOnce);
describe('reader background queue failure boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    prepare.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('survives queue P2028 without changing any import and later polls again', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const legacyLookup = jest.fn().mockResolvedValue(null);
    const prisma = {
      bookProcessingRun: { findFirst: legacyLookup },
    } as unknown as PrismaService;
    const service = new ReaderProcessingService(prisma);
    prepare.mockRejectedValueOnce(
      Object.assign(new Error('private URI'), { code: 'P2028' }),
    );
    await expect(service.processPendingRunsOnce()).resolves.toBe(false);
    expect(legacyLookup).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('P2028'));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private URI');
    await service.processPendingRunsOnce();
    expect(prepare).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    prepare.mockResolvedValueOnce(false);
    await expect(service.processPendingRunsOnce()).resolves.toBe(false);
    expect(legacyLookup).toHaveBeenCalledTimes(1);
    prepare.mockResolvedValueOnce(true);
    await expect(service.processPendingRunsOnce()).resolves.toBe(true);
    expect(legacyLookup).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });
});
