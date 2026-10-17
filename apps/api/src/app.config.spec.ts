import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from './app.config';

it('allows reader negotiation headers for the configured web origin only', async () => {
  const prior = process.env.WEB_ORIGIN;
  process.env.WEB_ORIGIN = 'http://localhost:8760';
  const module = await Test.createTestingModule({}).compile();
  const app: INestApplication<App> = module.createNestApplication();
  try {
    configureApp(app);
    await app.init();
    const response = await request(app.getHttpServer())
      .options('/api/reader/book')
      .set('Origin', 'http://localhost:8760')
      .set('Access-Control-Request-Method', 'GET')
      .set(
        'Access-Control-Request-Headers',
        'authorization,x-ava-reader-schema,x-ava-reader-build',
      );
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8760',
    );
    const allowed = String(
      response.headers['access-control-allow-headers'],
    ).toLowerCase();
    expect(allowed).toContain('x-ava-reader-schema');
    expect(allowed).toContain('x-ava-reader-build');
    const foreign = await request(app.getHttpServer())
      .options('/api/reader/book')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  } finally {
    await app.close();
    if (prior === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = prior;
  }
});
