import { Prisma } from '@prisma/client';

export async function lockCheckpoint(
  tx: Prisma.TransactionClient,
  userId: string,
  libraryItemId: string,
  clientSessionId: string,
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${libraryItemId}, 0))`,
  );
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId + ':' + clientSessionId}, 1))`,
  );
}
