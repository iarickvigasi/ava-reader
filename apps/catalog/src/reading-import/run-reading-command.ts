import { bindProvider } from './bootstrap/bind-provider';
import { bootstrapCollection } from './bootstrap/bootstrap-collection';
import { readManifest } from './read-manifest';
import { candidateSource, CURATED_SOURCE } from './candidate-source';
import type { CatalogDatabase } from '../database/catalog-database';
import { withImportLock } from '../importer/with-import-lock';
import { assertMetadataFinished } from './assert-metadata-finished';
import { inventory } from './inventory';
import { runManifest } from './run-manifest';
import { writeManifest } from './write-manifest';
import type { readingOptions } from './reading-options';

export async function runReadingCommand(
  db: CatalogDatabase,
  values: ReturnType<typeof readingOptions>,
) {
  if (values.bind) return withImportLock(() => bindProvider(db, values.file!));
  if (values.bootstrap || values.inventory) {
    const manifest = await withImportLock(async () => {
      if (values.bootstrap) return bootstrapCollection(db, values.file!);
      await assertMetadataFinished(db);
      return inventory(db, values.limit, values.language);
    });
    await writeManifest(values.output!, manifest);
    return { candidates: manifest.candidates.length };
  }
  const manifest = await readManifest(values.file!);
  if (
    !manifest.candidates.every(
      (candidate) => candidateSource(candidate) === CURATED_SOURCE,
    )
  )
    await assertMetadataFinished(db);
  // Downloads and Main processing waits do not hold the metadata import lock.
  // Each operation revalidates source identity; publication checks it again transactionally.
  return runManifest(db, {
    file: values.file!,
    output: values.output,
    mode: values.inspect ? 'inspect' : 'apply',
  });
}
