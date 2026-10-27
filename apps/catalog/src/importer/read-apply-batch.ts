import { batchSettings, type BatchSettings } from './batch-settings';
import { readPayloadPage } from './read-payload-page';
import { randomUUID } from 'node:crypto';
import type { ImportContext } from './import-operation';
import { readImportPhase } from './read-import-phase';
import type { CatalogDatabase } from '../database/catalog-database';
import { RecordStatus, type Kind } from './types';

type Page = { runId: string; kind: Kind; after?: string };

export async function readApplyBatch(
  db: CatalogDatabase,
  page: Page,
  context: ImportContext = { operation: 'readApplyBatch', ...page },
  settings: BatchSettings = batchSettings(),
) {
  context.readId = randomUUID();
  const candidates: { id: string }[] = [];
  for (const status of [RecordStatus.PENDING, RecordStatus.UNRESOLVED]) {
    const phase =
      status === RecordStatus.PENDING ? 'pendingIds' : 'unresolvedIds';
    const ids = await readImportPhase(context, phase, () =>
      db.importRecord.findMany({
        where: {
          runId: page.runId,
          kind: page.kind,
          status,
          ...(page.after ? { id: { gt: page.after } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: settings.readSize,
      }),
    );
    candidates.push(...ids);
  }
  const ids = candidates
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    )
    .slice(0, settings.readSize)
    .map(({ id }) => id);
  if (!ids.length) return [];
  return readImportPhase(context, 'payloads', () =>
    readPayloadPage(db, ids, settings.readBytes),
  );
}
