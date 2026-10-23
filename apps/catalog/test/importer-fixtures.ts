import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { CatalogDatabase } from '../src/database/catalog-database';
import type { Raw } from '../src/importer/types';

export function dumpLine(key: string, kind: string, data: Raw, revision = 1) {
  const type = `/type/${kind.toLowerCase()}`;
  return [
    type,
    key,
    revision,
    '2026-10-23T12:00:00.000000',
    JSON.stringify({ key, type: { key: type }, ...data }),
  ].join('\t');
}

export type ImportFixture = ReturnType<typeof fixture>;
export function fixture(db: CatalogDatabase, directory: string) {
  const prefix = `ava-import-${Date.now()}`;
  const number = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const author = `/authors/OL${number}A`;
  const work = `/works/OL${number}W`;
  const edition = `/books/OL${number}M`;
  return {
    db,
    prefix,
    author,
    work,
    edition,
    async file(label: string, rows: string[], gzip = false) {
      const path = join(
        directory,
        `${prefix}-${label}.txt${gzip ? '.gz' : ''}`,
      );
      const text = rows.join('\n') + '\n';
      await writeFile(path, gzip ? gzipSync(text) : text);
      return path;
    },
    async mapped(key: string) {
      return db.sourceMapping.findFirstOrThrow({
        where: { externalId: key, source: { key: 'open-library' } },
      });
    },
  };
}
