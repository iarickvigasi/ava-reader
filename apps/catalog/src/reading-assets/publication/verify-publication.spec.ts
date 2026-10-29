import { createHmac } from 'node:crypto';
import { verifyPublication } from './verify-publication';

const prior = process.env.READING_ASSET_SYNC_SECRET;
beforeEach(() => {
  process.env.READING_ASSET_SYNC_SECRET =
    'test-only-secret-key-32-characters-long';
});
afterEach(() => {
  if (prior === undefined) delete process.env.READING_ASSET_SYNC_SECRET;
  else process.env.READING_ASSET_SYNC_SECRET = prior;
});
it('accepts signed current payloads, but not tampering, expiry, or missing configuration', () => {
  const body = { editionId: 'edition', revision: 2 };
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', process.env.READING_ASSET_SYNC_SECRET!)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest('hex');
  expect(() => verifyPublication(body, timestamp, signature)).not.toThrow();
  expect(() =>
    verifyPublication({ ...body, revision: 1 }, timestamp, signature),
  ).toThrow();
  expect(() =>
    verifyPublication(body, String(Date.now() - 600_000), signature),
  ).toThrow();
  delete process.env.READING_ASSET_SYNC_SECRET;
  expect(() => verifyPublication(body, timestamp, signature)).toThrow(
    'not configured',
  );
});
