export type MasteryHistoryPage = {
  days: Array<{ key: string; seconds: number }>;
  clientSessionIds: string[];
  nextBefore: string | null;
};
