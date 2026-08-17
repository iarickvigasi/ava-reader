import { Prisma } from '@prisma/client';
import type { LockedSessionRecord } from './session-record';

// Kept as one fragment so the two lock queries below cannot drift apart, or
// away from `lockedSessionSelect`.
const SESSION_LOCK_COLUMNS = Prisma.sql`
  "id",
  "userId",
  "libraryItemId",
  "trackedDay",
  "durationSeconds",
  "startedAt",
  "lastTrackedAt",
  "endedAt"
`;

async function lockSessionTx(
  tx: Prisma.TransactionClient,
  criteria: Prisma.Sql,
): Promise<LockedSessionRecord | null> {
  const rows = await tx.$queryRaw<LockedSessionRecord[]>(Prisma.sql`
    SELECT ${SESSION_LOCK_COLUMNS}
    FROM "ReadingSession"
    ${criteria}
    FOR UPDATE
  `);

  return rows[0] ?? null;
}

// The session currently open for this book, whoever started it.
export function lockActiveSessionTx(
  tx: Prisma.TransactionClient,
  userId: string,
  libraryItemId: string,
) {
  return lockSessionTx(
    tx,
    Prisma.sql`
      WHERE "userId" = ${userId}
        AND "libraryItemId" = ${libraryItemId}
        AND "endedAt" IS NULL
      ORDER BY "startedAt" DESC
      LIMIT 1
    `,
  );
}

// A specific session, scoped to its owner so one user cannot touch another's.
export function lockOwnedSessionTx(
  tx: Prisma.TransactionClient,
  userId: string,
  libraryItemId: string,
  sessionId: string,
) {
  return lockSessionTx(
    tx,
    Prisma.sql`
      WHERE "id" = ${sessionId}
        AND "libraryItemId" = ${libraryItemId}
        AND "userId" = ${userId}
      LIMIT 1
    `,
  );
}
