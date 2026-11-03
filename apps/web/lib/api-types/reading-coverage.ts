export type ReadingCoverage = {
  clientSessionIds: string[];
  sessionCoverage?: Array<{ clientSessionId: string; durationSeconds: number }>;
  readingRevision?: number;
};

export type BookReadingSnapshot = ReadingCoverage & { totalSeconds: number };
