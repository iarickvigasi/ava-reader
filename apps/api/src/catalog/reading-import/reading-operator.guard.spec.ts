import { createHmac } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { ReadingOperatorGuard } from './reading-operator.guard';
import { operatorContentDigest } from './operator-content-digest';

describe('server import authorization', () => {
  const secret = 's'.repeat(32);
  const previous = process.env.READING_ASSET_SYNC_SECRET;
  const guard = new ReadingOperatorGuard();
  beforeEach(() => {
    process.env.READING_ASSET_SYNC_SECRET = secret;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.READING_ASSET_SYNC_SECRET;
    else process.env.READING_ASSET_SYNC_SECRET = previous;
  });
  function request(body: unknown = { editionId: 'edition' }, age = 0) {
    const timestamp = String(Date.now() - age);
    const contentHash = operatorContentDigest(body);
    const payload = {
      scope: 'reading-import-operator',
      method: 'POST',
      path: '/api/internal/reading-imports/publish',
      contentHash,
    };
    const headers: Record<string, string> = {
      'x-reading-timestamp': timestamp,
      'x-reading-import-digest': contentHash,
      'x-reading-signature': createHmac('sha256', secret)
        .update(`${timestamp}.${JSON.stringify(payload)}`)
        .digest('hex'),
    };
    const req = {
      method: 'POST',
      originalUrl: payload.path,
      body,
      get: (key: string) => headers[key],
      is: () => false,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req, headers, context };
  }
  it('accepts a signed server operation without a user token', () => {
    expect(guard.canActivate(request().context)).toBe(true);
  });
  it('rejects unsigned requests', () => {
    const r = request();
    delete r.headers['x-reading-signature'];
    expect(() => guard.canActivate(r.context)).toThrow(
      'Invalid server import signature',
    );
  });
  it('rejects expired signatures', () => {
    expect(() =>
      guard.canActivate(request(undefined, 300_001).context),
    ).toThrow();
  });
  it.each(['method', 'originalUrl', 'body'] as const)(
    'binds %s to the signature',
    (field) => {
      const r = request();
      Object.assign(r.req, { [field]: 'tampered' });
      expect(() => guard.canActivate(r.context)).toThrow();
    },
  );
  it('fails closed without the server secret', () => {
    const r = request();
    delete process.env.READING_ASSET_SYNC_SECRET;
    expect(() => guard.canActivate(r.context)).toThrow('not configured');
  });
  it('checks multipart manifest content after upload parsing', () => {
    const digest = operatorContentDigest('{"editionId":"original"}');
    expect(() =>
      operatorContentDigest('{"editionId":"changed"}', digest),
    ).toThrow();
  });
});
