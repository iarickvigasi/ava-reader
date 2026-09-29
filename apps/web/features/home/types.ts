import type { ReadingDaySource } from "@/lib/api-types/reading-day-source";
export type MasteryHistoryPage = ReadingDaySource & {
  clientSessionIds: string[];
  nextBefore: string | null;
};
