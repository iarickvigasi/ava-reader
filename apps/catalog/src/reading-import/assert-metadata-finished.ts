import type { CatalogDatabase } from '../database/catalog-database';
import { SOURCE_KEY } from '../importer/types';

export async function assertMetadataFinished(db: CatalogDatabase) {
  const source = { source: { key: SOURCE_KEY } };
  const unfinishedRuns = await db.importRun.count({
    where: { ...source, status: { in: ['STAGING', 'FAILED'] } },
  });
  const unfinishedRecords = await db.importRecord.count({
    where: { run: source, status: 'PENDING' },
  });
  if (unfinishedRuns || unfinishedRecords)
    throw new Error(
      `Finish metadata import first: ${unfinishedRuns} unfinished runs, ${unfinishedRecords} pending records. Run import:open-library --retry.`,
    );
  const editions = await db.sourceMapping.count({
    where: { ...source, entityKind: 'EDITION', editionId: { not: null } },
  });
  if (!editions) throw new Error('No imported Open Library editions found');
  const unresolved = await db.importRecord.count({
    where: { run: source, status: 'UNRESOLVED' },
  });
  if (unresolved)
    console.error(
      JSON.stringify({
        unresolvedMetadataRecords: unresolved,
        message:
          'Unresolved editions are excluded; retry metadata dependencies separately',
      }),
    );
}
