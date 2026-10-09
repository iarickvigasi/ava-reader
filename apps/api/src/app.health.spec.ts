import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { configureApp } from './app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('API health and reachability over HTTP', () => {
  let app: INestApplication;
  const query = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: query } },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => query.mockReset());
  afterAll(async () => app.close());

  it('returns uncached HTTP 200 when the controlled dependency is healthy', async () => {
    query.mockResolvedValueOnce([{ '?column?': 1 }]);
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect('Cache-Control', 'no-store')
      .expect(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'api',
      database: 'up',
      timestamp: expect.any(String),
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns uncached HTTP 503 without publishing dependency exception details', async () => {
    query.mockRejectedValueOnce(new Error('private connection diagnostics'));
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect('Cache-Control', 'no-store')
      .expect(503);
    expect(response.body).toEqual({
      status: 'degraded',
      service: 'api',
      database: 'down',
      timestamp: expect.any(String),
    });
    expect(response.text).not.toContain('private connection diagnostics');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('serves public uncached reachability without consulting a failing database', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    await request(app.getHttpServer() as Server)
      .get('/api/reachability')
      .expect('Cache-Control', 'no-store')
      .expect(200, { service: 'ava-reader-api' });
    expect(query).not.toHaveBeenCalled();
    await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(503);
    await request(app.getHttpServer() as Server)
      .get('/api/reachability')
      .expect('Cache-Control', 'no-store')
      .expect(200, { service: 'ava-reader-api' });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
