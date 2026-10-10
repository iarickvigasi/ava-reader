import { ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

const timestamp = '2026-10-09T00:00:00.000Z';

describe('API dependency health', () => {
  const query = jest.fn();
  const service = new AppService({
    $queryRaw: query,
  } as unknown as PrismaService);

  beforeEach(() => {
    query.mockReset();
    jest.useFakeTimers().setSystemTime(Date.parse(timestamp));
  });
  afterEach(() => jest.useRealTimers());

  it('returns healthy readiness after the cheap database query succeeds', async () => {
    query.mockResolvedValueOnce([{ '?column?': 1 }]);
    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'api',
      database: 'up',
      timestamp,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]).toEqual([['SELECT 1']]);
  });

  it('fails closed with only safe dependency fields when the query fails', async () => {
    query.mockRejectedValueOnce(new Error('private connection diagnostics'));
    const failure: unknown = await service
      .getHealth()
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    if (!(failure instanceof ServiceUnavailableException)) throw failure;
    expect(failure.getStatus()).toBe(503);
    expect(failure.getResponse()).toEqual({
      status: 'degraded',
      service: 'api',
      database: 'down',
      timestamp,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
