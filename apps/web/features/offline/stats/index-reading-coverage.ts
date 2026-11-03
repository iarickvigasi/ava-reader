import type { ReadingCoverage } from "@/lib/api-types/reading-coverage";

export type ReadingCoverageIndex = {
  sessionIds: ReadonlySet<string>;
  secondsBySession: ReadonlyMap<string, number>;
};

export function indexReadingCoverage(
  snapshot: ReadingCoverage,
): ReadingCoverageIndex {
  return {
    sessionIds: new Set(snapshot.clientSessionIds),
    secondsBySession: new Map(
      snapshot.sessionCoverage?.map(({ clientSessionId, durationSeconds }) => [
        clientSessionId,
        durationSeconds,
      ]),
    ),
  };
}
