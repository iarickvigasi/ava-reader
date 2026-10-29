import { createHmac } from 'node:crypto';
import type { CatalogDatabase } from '../database/catalog-database';
import { EditorialController } from './editorial.controller';

const findUnique = jest.fn().mockResolvedValue({ id: 'record' });
const controller = new EditorialController({
  author: { findUnique },
} as unknown as CatalogDatabase);
const original = process.env.READING_ASSET_SYNC_SECRET;
beforeEach(() => {
  process.env.READING_ASSET_SYNC_SECRET = 's'.repeat(32);
  findUnique.mockClear();
});
afterAll(() => {
  if (original === undefined) delete process.env.READING_ASSET_SYNC_SECRET;
  else process.env.READING_ASSET_SYNC_SECRET = original;
});
it('rejects unsigned requests and forged browser admin claims before accessing metadata', async () => {
  await expect(
    controller.execute(
      {
        operation: 'get',
        kind: 'authors',
        id: '00000000-0000-4000-8000-000000000001',
        isAdmin: true,
      },
      String(Date.now()),
      '0'.repeat(64),
    ),
  ).rejects.toThrow();
  expect(findUnique).not.toHaveBeenCalled();
});
it('accepts a signed operation only for an allowed entity and fresh timestamp', async () => {
  const body = {
    operation: 'get',
    kind: 'authors',
    id: '00000000-0000-4000-8000-000000000001',
  };
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', process.env.READING_ASSET_SYNC_SECRET!)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest('hex');
  await expect(controller.execute(body, timestamp, signature)).resolves.toEqual(
    { id: 'record' },
  );
  await expect(
    controller.execute(body, String(Date.now() - 600_000), signature),
  ).rejects.toThrow();
});
