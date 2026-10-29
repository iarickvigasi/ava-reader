import { createHmac } from 'node:crypto';
import { mainRequest } from './main-request';
import { operatorHeaders } from './operator-headers';

describe('operator import requests', () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    delete process.env.READING_IMPORT_ADMIN_TOKEN;
    process.env.READING_ASSET_SYNC_SECRET = 's'.repeat(32);
    process.env.READING_IMPORT_MAIN_API_URL = 'http://api:4000/api';
  });
  it('uses the internal endpoint without an admin token', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    await mainRequest('reading-imports?editionId=one');
    const [url, options] = fetcher.mock.calls[0];
    expect((url as URL).href).toBe(
      'http://api:4000/api/internal/reading-imports?editionId=one',
    );
    expect(options?.headers).toHaveProperty('x-reading-signature');
    expect(options?.headers).not.toHaveProperty('Authorization');
  });
  it('retains explicit browser admin tokens', async () => {
    process.env.READING_IMPORT_ADMIN_TOKEN = 'token';
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    await mainRequest('reading-imports');
    expect((fetcher.mock.calls[0][0] as URL).href).toContain(
      '/admin/reading-imports',
    );
    expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty(
      'Authorization',
      'Bearer token',
    );
  });
  it('does not sign arbitrary API operations', async () => {
    await expect(mainRequest('users')).rejects.toThrow('Unsupported');
  });
  it('requires server credentials when no token is supplied', () => {
    delete process.env.READING_ASSET_SYNC_SECRET;
    expect(() =>
      operatorHeaders(new URL('http://api/api/internal/reading-imports')),
    ).toThrow();
  });
  it('signs the canonical manifest and full request identity', () => {
    const url = new URL('http://api/api/internal/reading-imports');
    const body = new FormData();
    body.set('manifest', '{ "a": 1 }');
    const headers = operatorHeaders(url, body);
    const payload = {
      scope: 'reading-import-operator',
      method: 'POST',
      path: url.pathname,
      contentHash: headers['x-reading-import-digest'],
    };
    const expected = createHmac('sha256', 's'.repeat(32))
      .update(`${headers['x-reading-timestamp']}.${JSON.stringify(payload)}`)
      .digest('hex');
    expect(headers['x-reading-signature']).toBe(expected);
  });
});
