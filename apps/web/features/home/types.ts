import type { ReadingCoverage } from "@/lib/api-types/reading-coverage";
import type { ReadingDaySource } from "@/lib/api-types/reading-day-source";
export type MasteryHistoryPage = ReadingDaySource &
  ReadingCoverage & {
    nextBefore: string | null;
  };
