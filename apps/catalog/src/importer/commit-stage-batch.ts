import type { Prisma } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';

const STAGING_STATEMENT_TIMEOUT = '60s';
const STAGING_TRANSACTION_TIMEOUT_MS = 120_000;
const STAGING_MAX_WAIT_MS = 30_000;

export async function commitStageBatch(
  db: CatalogDatabase,
  runId: string,
  batch: Prisma.ImportRecordCreateManyInput[],
) {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', ${STAGING_STATEMENT_TIMEOUT}, true)`;
      await tx.importRecord.createMany({ data: batch });
      await tx.importRun.update({
        where: { id: runId },
        data: { checkpoint: batch[batch.length - 1].line },
      });
    },
    {
      maxWait: STAGING_MAX_WAIT_MS,
      timeout: STAGING_TRANSACTION_TIMEOUT_MS,
    },
  );
}
