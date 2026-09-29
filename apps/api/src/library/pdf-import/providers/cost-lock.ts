import { Prisma } from '@prisma/client';
import type { Tx } from '../jobs/types';
import type { PrismaService } from '../../../prisma/prisma.service';
export async function costLock(tx: Tx) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended('ava-pdf-provider-cost-v1',0))`,
  );
}
export function costTransaction<T>(
  prisma: PrismaService,
  work: (tx: Tx) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await costLock(tx);
      return work(tx);
    },
    { timeout: 30000 },
  );
}
