import { assertMetadataFinished } from './assert-metadata-finished';
import type { CatalogDatabase } from '../database/catalog-database';

const db = {
  importRun: { count: jest.fn() },
  importRecord: { count: jest.fn() },
  sourceMapping: { count: jest.fn() },
};
beforeEach(() => {
  jest.resetAllMocks();
  db.importRun.count.mockResolvedValue(0);
  db.importRecord.count.mockResolvedValue(0);
  db.sourceMapping.count.mockResolvedValue(1);
});
it('refuses unfinished staging/application and an absent edition import', async () => {
  db.importRun.count.mockResolvedValueOnce(1);
  await expect(
    assertMetadataFinished(db as unknown as CatalogDatabase),
  ).rejects.toThrow('Finish metadata');
  db.importRecord.count.mockResolvedValueOnce(10);
  await expect(
    assertMetadataFinished(db as unknown as CatalogDatabase),
  ).rejects.toThrow('10 pending');
  db.sourceMapping.count.mockResolvedValueOnce(0);
  await expect(
    assertMetadataFinished(db as unknown as CatalogDatabase),
  ).rejects.toThrow('No imported');
});
it('permits completed metadata and reports unresolved rows without publishing them', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  db.importRecord.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
  await expect(
    assertMetadataFinished(db as unknown as CatalogDatabase),
  ).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(
    expect.stringContaining('unresolvedMetadataRecords'),
  );
  log.mockRestore();
});
