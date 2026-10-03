import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { Tx } from './types';
export async function queueLock(tx: Tx) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended('ava-pdf-jobs-v1', 0))`,
  );
}
export function jobTransaction<T>(
  prisma: PrismaService,
  work: (tx: Tx) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await queueLock(tx);
      return work(tx);
    },
    { timeout: 30000 },
  );
}
export async function databaseNow(tx: Tx): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>(
    Prisma.sql`SELECT clock_timestamp() AS now`,
  );
  return row.now;
}
export async function lockLibraryItem(tx: Tx, libraryItemId: string) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${libraryItemId}, 0))`,
  );
}
