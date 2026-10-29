import type { CatalogDatabase } from '../database/catalog-database';
import { loadEditorial } from '../editorial/load-editorial';

// Operator-only database command; never part of the public discovery API.
export async function importConflicts(db: CatalogDatabase, after?: string) {
  const rows = await db.importRecord.findMany({
    where: {
      OR: [
        { status: 'CONFLICT' },
        {
          status: 'UNRESOLVED',
          diagnostic: { startsWith: 'Enriched; preserved conflicting fields:' },
        },
      ],
      ...(after ? { id: { gt: after } } : {}),
    },
    orderBy: { id: 'asc' },
    take: 21,
    include: { run: { select: { sourceId: true } } },
  });
  const items = [];
  for (const row of rows.slice(0, 20)) {
    const mapping =
      row.externalId && row.kind
        ? await db.sourceMapping.findUnique({
            where: {
              sourceId_entityKind_externalId: {
                sourceId: row.run.sourceId,
                entityKind: row.kind,
                externalId: row.externalId,
              },
            },
          })
        : null;
    const id = mapping?.authorId ?? mapping?.workId ?? mapping?.editionId;
    const kind = mapping?.authorId
      ? 'authors'
      : mapping?.workId
        ? 'works'
        : 'editions';
    items.push({
      recordId: row.id,
      sourceId: row.run.sourceId,
      externalId: row.externalId,
      diagnostic: row.diagnostic,
      incoming: row.payload,
      current: id ? await loadEditorial(db, kind, id) : null,
    });
  }
  return { items, nextCursor: rows.length > 20 ? rows[19].id : null };
}
