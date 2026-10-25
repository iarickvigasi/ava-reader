import type { CatalogDatabase } from '../src/database/catalog-database';

export async function seedApplyRecords(db: CatalogDatabase, runId: string) {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', '60s', true)`;
      await tx.$executeRaw`
      INSERT INTO "ImportRecord" (id, "runId", line, kind, status, payload)
      SELECT md5(${runId} || n::text)::uuid, ${runId}::uuid, n, 'AUTHOR',
        (CASE WHEN n % 10 = 0 THEN 'APPLIED'
              WHEN n % 2 = 0 THEN 'UNRESOLVED' ELSE 'PENDING' END)::"ImportRecordStatus",
        '{"name":"Selection fixture"}'::jsonb
      FROM generate_series(1, 100000) AS n`;
      await tx.$executeRawUnsafe('ANALYZE "ImportRecord"');
    },
    { timeout: 120000 },
  );
}
