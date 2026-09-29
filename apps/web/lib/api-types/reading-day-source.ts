export type ReadingDaySource = {
  version?: 2 | 3;
  timeZone?: string;
  intervals?: Array<{ startedAt: string; endedAt: string; timeZone?: string }>;
  legacyDays?: Array<{ key: string; seconds: number }>;
  days: Array<{ key: string; seconds: number }>;
};
