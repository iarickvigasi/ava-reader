import type {
  BilingualPage,
  MeasuredBilingualUnit,
  PaginatePairsInput,
  PaginatePairsResult,
} from "../types";

/** Mutable construction state stays private to one pure pagination call. */
export class PairPaginationState {
  pages: BilingualPage[] = [];
  pending: BilingualPage | null = null;

  constructor(
    readonly units: readonly MeasuredBilingualUnit[],
    readonly paneHeight: number,
    public index: number,
    readonly measureRange?: PaginatePairsInput["measureRange"],
  ) {}

  exceedsPendingPage(height: number, gap: number) {
    return (
      this.pending !== null &&
      this.pending.usedHeight + gap + height > this.paneHeight
    );
  }

  finalizePendingPage() {
    if (!this.pending) return;
    this.pages.push({ ...this.pending, isComplete: true });
    this.pending = null;
  }

  appendRow(height: number, gap: number, flowHeight?: number) {
    if (this.pending) {
      this.pending.unitIndexes.push(this.index);
      this.pending.usedHeight =
        flowHeight ?? this.pending.usedHeight + gap + height;
    } else {
      this.pending = {
        unitIndexes: [this.index],
        startUnitId: this.units[this.index].id,
        usedHeight: flowHeight ?? height,
        isComplete: false,
      };
    }
    this.index += 1;
    if (this.pending.usedHeight === this.paneHeight) this.finalizePendingPage();
  }

  appendContinuations(count: number, maxPages: number) {
    const unitId = this.units[this.index].id;
    for (
      let continuationIndex = 0;
      continuationIndex < count;
      continuationIndex += 1
    ) {
      this.pages.push({
        unitIndexes: [this.index],
        startUnitId: unitId,
        usedHeight: this.paneHeight,
        isComplete: true,
        continuationIndex,
      });
      if (continuationIndex === count - 1) this.index += 1;
      if (this.pages.length >= maxPages) return;
    }
  }

  result(
    missingIndex: number | null = null,
    measurementId: string | null = null,
  ): PaginatePairsResult {
    return {
      pages: this.pending ? [...this.pages, this.pending] : this.pages,
      nextMissingUnitId:
        missingIndex === null ? null : this.units[missingIndex].id,
      nextMissingUnitIndex: missingIndex,
      nextMeasurementUnitId: measurementId,
      nextUnitIndex: this.index,
      isComplete: this.index === this.units.length,
    };
  }
}
