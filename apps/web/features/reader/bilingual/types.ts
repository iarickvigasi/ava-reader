/** Heights are measured at the actual pane width and active reader font. */
export type MeasuredBilingualUnit = {
  id: string;
  kind: "sentence" | "image";
  sourceHeight: number;
  /** null means this sentence has not been translated yet. Images ignore it. */
  translationHeight: number | null;
  /** Measured CSS column counts, required for each side taller than a pane. */
  sourcePageCount?: number;
  translationPageCount?: number;
};

export type BilingualPage = {
  /** Indexes into the units passed to paginatePairs, in reading order. */
  unitIndexes: number[];
  startUnitId: string;
  usedHeight: number;
  /** False only for the last, provisional page awaiting a sentence/measurement. */
  isComplete: boolean;
  /** Oversized sentences occupy one or more pages, without sharing their rows. */
  continuationIndex?: number;
};

export type PaginatePairsInput = {
  units: readonly MeasuredBilingualUnit[];
  paneHeight: number;
  rowGap?: number;
  /** Allows opening a cached range without translating earlier sentences. */
  startUnitIndex?: number;
  /** Only finalized pages count toward this limit. */
  maxPages?: number;
  /** Exact natural flow of a contiguous page candidate, with end excluded. */
  measureRange?: (
    start: number,
    end: number,
  ) => { sourceHeight: number; translationHeight: number | null };
};

export type PaginatePairsResult = {
  pages: BilingualPage[];
  nextMissingUnitId: string | null;
  nextMissingUnitIndex: number | null;
  /** An oversized sentence needs real column measurement before pagination. */
  nextMeasurementUnitId: string | null;
  /** First unconsumed unit; may be a partially consumed oversized sentence. */
  nextUnitIndex: number;
  /** True only when all units from startUnitIndex to the end were consumed. */
  isComplete: boolean;
};
