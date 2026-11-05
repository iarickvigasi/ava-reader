import { Prisma } from '@prisma/client';

export const readingCoverageSelect = {
  clientSessionId: true,
  durationSeconds: true,
  trackingVersion: true,
} satisfies Prisma.ReadingSessionSelect;

type CoveredSession = Prisma.ReadingSessionGetPayload<{
  select: typeof readingCoverageSelect;
}>;

export function readingCoverage(
  sessions: CoveredSession[],
  readingRevision: number,
) {
  return {
    readingRevision,
    clientSessionIds: sessions.flatMap((row) =>
      row.clientSessionId ? [row.clientSessionId] : [],
    ),
    sessionCoverage: sessions.flatMap((row) =>
      row.trackingVersion === 2 && row.clientSessionId
        ? [
            {
              clientSessionId: row.clientSessionId,
              durationSeconds: row.durationSeconds,
            },
          ]
        : [],
    ),
  };
}
