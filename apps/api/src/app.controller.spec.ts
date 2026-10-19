import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const getHealth = jest.fn().mockResolvedValue({
    status: 'ok',
    service: 'api',
    database: 'up',
    timestamp: '2026-04-02T00:00:00.000Z',
  });

  beforeEach(async () => {
    getHealth.mockClear();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getHealth },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('serves an uncached reachability marker without querying health', () => {
    getHealth.mockClear();
    expect(appController.getReachability()).toEqual({
      service: 'ava-reader-api',
    });
    expect(getHealth).not.toHaveBeenCalled();
    expect(
      Reflect.getMetadata('__headers__', appController.getReachability),
    ).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });

  describe('health', () => {
    it('preserves the dependency-unavailable exception for the HTTP adapter', async () => {
      const failure = new ServiceUnavailableException({
        status: 'degraded',
        service: 'api',
        database: 'down',
      });
      getHealth.mockRejectedValueOnce(failure);
      await expect(appController.getHealth()).rejects.toBe(failure);
    });

    it('should return the API health payload', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        service: 'api',
        database: 'up',
        timestamp: '2026-04-02T00:00:00.000Z',
      });
    });
  });
});
