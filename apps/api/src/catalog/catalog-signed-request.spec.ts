import { createHmac } from 'node:crypto';
import { catalogSignedRequest } from './catalog-signed-request';
const prior = {
  secret: process.env.READING_ASSET_SYNC_SECRET,
  base: process.env.CATALOG_API_BASE_URL,
};
beforeEach(() => {
  process.env.READING_ASSET_SYNC_SECRET =
    'test-only-secret-key-32-characters-long';
  process.env.CATALOG_API_BASE_URL = 'http://catalog:4001';
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of [
    ['READING_ASSET_SYNC_SECRET', prior.secret],
    ['CATALOG_API_BASE_URL', prior.base],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});
it('signs the exact JSON and forbids redirects for each JSON operation', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1234);
  const request = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('{}'));
  await catalogSignedRequest('internal/editorial', { title: 'Corrected' });
  const [, init] = request.mock.calls[0];
  expect(init?.body).toBe('{"title":"Corrected"}');
  expect(init?.redirect).toBe('error');
  expect(init?.headers).toMatchObject({
    'x-reading-timestamp': '1234',
    'x-reading-signature': createHmac(
      'sha256',
      process.env.READING_ASSET_SYNC_SECRET!,
    )
      .update('1234.{"title":"Corrected"}')
      .digest('hex'),
  });
});
it('retains separate storage authentication and exact blob read identity', async () => {
  const request = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('bytes'));
  await catalogSignedRequest(
    'reading-assets/blobs',
    { blobId: 'blob' },
    { readBlobId: 'blob' },
  );
  const [url, init] = request.mock.calls[0];
  expect((url as URL).href).toBe(
    'http://catalog:4001/api/reading-assets/blobs/blob',
  );
  expect(init?.method).toBe('GET');
  expect(init?.body).toBeUndefined();
  expect(init?.headers).toHaveProperty('x-reading-auth', expect.any(String));
});
it('rejects remote plain HTTP and missing credentials before a request', async () => {
  const request = jest.spyOn(global, 'fetch');
  process.env.CATALOG_API_BASE_URL = 'http://example.com';
  await expect(catalogSignedRequest('internal/editorial', {})).rejects.toThrow(
    'HTTPS',
  );
  delete process.env.READING_ASSET_SYNC_SECRET;
  await expect(catalogSignedRequest('internal/editorial', {})).rejects.toThrow(
    'not configured',
  );
  expect(request).not.toHaveBeenCalled();
});
