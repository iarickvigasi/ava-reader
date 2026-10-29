import { readFile, stat } from 'node:fs/promises';
import type { CatalogDatabase } from '../../database/catalog-database';
import { SOURCE_KEY } from '../../importer/types';
import { MAX_CANDIDATES, MAX_MANIFEST_BYTES } from '../types';
type Binding = {
  kind: 'WORK' | 'EDITION' | 'AUTHOR';
  id: string;
  externalId: string;
  confirmed: boolean;
};
export async function bindProvider(db: CatalogDatabase, file: string) {
  if ((await stat(file)).size > MAX_MANIFEST_BYTES)
    throw new Error('Bindings too large');
  const bindings = JSON.parse(await readFile(file, 'utf8')) as Binding[];
  if (
    !Array.isArray(bindings) ||
    !bindings.length ||
    bindings.length > MAX_CANDIDATES
  )
    throw new Error('Supply 1..100 bindings');
  for (const row of bindings) {
    const expression =
      row?.kind === 'WORK'
        ? /^\/works\/OL\d+W$/
        : row?.kind === 'EDITION'
          ? /^\/books\/OL\d+M$/
          : row?.kind === 'AUTHOR'
            ? /^\/authors\/OL\d+A$/
            : null;
    if (
      !expression?.test(row.externalId) ||
      !/^[a-f\d-]{36}$/i.test(row.id) ||
      row.confirmed !== true
    )
      throw new Error('Verify each exact provider identity before binding');
  }
  await db.$transaction(async (tx) => {
    const source = await tx.source.upsert({
      where: { key: SOURCE_KEY },
      create: { key: SOURCE_KEY, name: 'Open Library' },
      update: {},
    });
    for (const row of bindings) {
      const target =
        row.kind === 'WORK'
          ? await tx.work.findUniqueOrThrow({
              where: { id: row.id, deletedAt: null },
            })
          : row.kind === 'EDITION'
            ? await tx.edition.findUniqueOrThrow({ where: { id: row.id } })
            : await tx.author.findUniqueOrThrow({ where: { id: row.id } });
      const key = {
        sourceId: source.id,
        entityKind: row.kind,
        externalId: row.externalId,
      };
      const existing = await tx.sourceMapping.findUnique({
        where: { sourceId_entityKind_externalId: key },
      });
      if (existing) {
        if (
          (existing.workId ?? existing.editionId ?? existing.authorId) !==
          row.id
        )
          throw new Error(
            'Provider ID already belongs to another description; reassign the edition or review a merge',
          );
        continue;
      }
      await tx.sourceMapping.create({
        data: {
          ...key,
          sourceRevision: '0',
          managedRevision: target.revision,
          sourceUrl: `https://openlibrary.org${row.externalId}`,
          ...(row.kind === 'WORK'
            ? { workId: target.id }
            : row.kind === 'EDITION'
              ? { editionId: target.id }
              : { authorId: target.id }),
        },
      });
    }
  });
  return { bindings: bindings.length };
}
