import { Prisma } from '@prisma/client';

export async function advanceReadingRevision(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$executeRaw(
    Prisma.sql`UPDATE "User" SET "readingRevision" = "readingRevision" + 1 WHERE "id" = ${userId}`,
  );
}
