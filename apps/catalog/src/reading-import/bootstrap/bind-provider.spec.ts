import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindProvider } from './bind-provider';
import type { CatalogDatabase } from '../../database/catalog-database';
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ava-bind-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
function fixture(mapping: object | null) {
  const create = jest.fn();
  const findWork = jest.fn();
  findWork.mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000001',
    revision: 1,
  });
  const tx = {
    source: { upsert: jest.fn().mockResolvedValue({ id: 'source' }) },
    work: { findUniqueOrThrow: findWork },
    author: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        revision: 9,
      }),
    },
    sourceMapping: { findUnique: jest.fn().mockResolvedValue(mapping), create },
  };
  return {
    create,
    db: {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    } as unknown as CatalogDatabase,
  };
}
async function file() {
  const path = join(directory, 'bindings.json');
  await writeFile(
    path,
    JSON.stringify([
      {
        kind: 'WORK',
        id: '00000000-0000-4000-8000-000000000001',
        externalId: '/works/OL123W',
        confirmed: true,
      },
    ]),
  );
  return path;
}
it('binds an exact provider identity to the existing local ID before later dumps', async () => {
  const f = fixture(null);
  await bindProvider(f.db, await file());
  expect(f.create).toHaveBeenCalledWith({
    data: {
      sourceId: 'source',
      entityKind: 'WORK',
      externalId: '/works/OL123W',
      sourceRevision: '0',
      managedRevision: 1,
      sourceUrl: 'https://openlibrary.org/works/OL123W',
      workId: '00000000-0000-4000-8000-000000000001',
    },
  });
});
it('refuses to steal an identity already assigned to a different description', async () => {
  const f = fixture({ workId: 'another-work' });
  await expect(bindProvider(f.db, await file())).rejects.toThrow(
    'already belongs',
  );
  expect(f.create).not.toHaveBeenCalled();
});
it('binds an existing author from another source at its current editorial revision', async () => {
  const f = fixture(null);
  const path = await file();
  await writeFile(
    path,
    JSON.stringify([
      {
        kind: 'AUTHOR',
        id: '00000000-0000-4000-8000-000000000001',
        externalId: '/authors/OL123A',
        confirmed: true,
      },
    ]),
  );
  await bindProvider(f.db, path);
  const [query] = f.create.mock.calls[0] as [{ data: Record<string, unknown> }];
  expect(query.data).toMatchObject({
    authorId: '00000000-0000-4000-8000-000000000001',
    managedRevision: 9,
  });
});
