import 'dotenv/config';
import { CatalogDatabase } from '../src/database/catalog-database';
import { withImportLock } from '../src/importer/with-import-lock';
import { applyPending } from '../src/importer/apply-pending';
import { RecordStatus, RunStatus, SOURCE_KEY } from '../src/importer/types';

async function main() {
  const db = new CatalogDatabase();
  try {
    await db.$connect();
    await withImportLock(async () => {
      let after: string | undefined;
      while (true) {
        const rows = await db.importRecord.findMany({
          where: {
            kind: { in: ['WORK', 'EDITION'] },
            status: RecordStatus.APPLIED,
            run: { source: { key: SOURCE_KEY }, status: RunStatus.STAGED },
            ...(after ? { id: { gt: after } } : {}),
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 100,
        });
        if (!rows.length) break;
        await db.importRecord.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { status: RecordStatus.UNRESOLVED },
        });
        after = rows[rows.length - 1].id;
      }
      await applyPending(db);
    });
    console.log(
      JSON.stringify({
        works: await db.work.count(),
        editions: await db.edition.count(),
        incompleteWorks: await db.work.count({
          where: { metadataIncomplete: true },
        }),
        coveredWorks: await db.work.count({
          where: { coverImageUrl: { not: null } },
        }),
        statuses: await db.importRecord.groupBy({
          by: ['status'],
          _count: true,
        }),
      }),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
