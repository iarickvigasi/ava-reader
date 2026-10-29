import { loadPublicBlob } from './load-public-blob';
import type { CatalogDatabase } from '../../database/catalog-database';
it('extends only the file-read transaction budget and reads the exact blob', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'blob', bytes });
  const execute = jest
    .fn<Promise<number>, [TemplateStringsArray]>()
    .mockResolvedValue(0);
  const tx = { $executeRaw: execute, publicBlob: { findUniqueOrThrow } };
  const transaction = jest
    .fn<
      Promise<unknown>,
      [(client: typeof tx) => Promise<unknown>, { timeout: number }]
    >()
    .mockImplementation((action) => action(tx));
  const db = { $transaction: transaction } as unknown as CatalogDatabase;
  await expect(loadPublicBlob(db, 'blob')).resolves.toEqual({
    id: 'blob',
    bytes,
  });
  expect(transaction.mock.calls[0][1]).toEqual({ timeout: 50_000 });
  const sql = execute.mock.calls[0][0];
  expect(sql.join('')).toBe("SET LOCAL statement_timeout = '45s'");
  expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'blob' } });
});
