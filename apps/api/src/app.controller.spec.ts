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

  describe('health', () => {
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
