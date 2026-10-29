import { runReadingCommand } from './run-reading-command';
import { withImportLock } from '../importer/with-import-lock';
import { runManifest } from './run-manifest';
import { readManifest } from './read-manifest';
import { bootstrapCollection } from './bootstrap/bootstrap-collection';
import { writeManifest } from './write-manifest';
import type { CatalogDatabase } from '../database/catalog-database';
import type { readingOptions } from './reading-options';
jest.mock('../importer/with-import-lock');
jest.mock('./run-manifest');
jest.mock('./read-manifest');
jest.mock('./bootstrap/bootstrap-collection');
jest.mock('./write-manifest');
const db = {} as CatalogDatabase;
let locked = false;
beforeEach(() => {
  jest.resetAllMocks();
  locked = false;
  jest.mocked(withImportLock).mockImplementation(async (action) => {
    locked = true;
    try {
      return await action();
    } finally {
      locked = false;
    }
  });
});
it.each(['inspect', 'apply'])(
  'does not hold a metadata lock during %s network/processing work',
  async (mode) => {
    jest.mocked(readManifest).mockResolvedValue({ version: 1, candidates: [] });
    jest.mocked(runManifest).mockImplementation(() => {
      expect(locked).toBe(false);
      return Promise.resolve({ candidates: 0, failures: 0, pending: 0 });
    });
    await runReadingCommand(db, {
      [mode]: true,
      file: 'manifest',
      limit: 12,
    } as ReturnType<typeof readingOptions>);
    expect(withImportLock).not.toHaveBeenCalled();
    expect(runManifest).toHaveBeenCalled();
  },
);
it('locks bootstrap writes but releases the lock before manifest disk I/O', async () => {
  jest.mocked(bootstrapCollection).mockImplementation(() => {
    expect(locked).toBe(true);
    return Promise.resolve({ version: 1, candidates: [] });
  });
  jest.mocked(writeManifest).mockImplementation(() => {
    expect(locked).toBe(false);
    return Promise.resolve();
  });
  await runReadingCommand(db, {
    bootstrap: true,
    file: 'collection',
    output: 'manifest',
    limit: 12,
  } as ReturnType<typeof readingOptions>);
  expect(bootstrapCollection).toHaveBeenCalled();
});
