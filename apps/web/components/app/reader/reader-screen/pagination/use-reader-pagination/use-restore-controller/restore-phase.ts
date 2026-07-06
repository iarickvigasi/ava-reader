import type { ReaderMeasurementEntry } from "@/features/reader/measurement";

export const READER_RESTORE_PHASE_RESTORING = "restoring";
export const READER_RESTORE_PHASE_SETTLED = "settled";

export type ReaderRestorePhase =
  | typeof READER_RESTORE_PHASE_RESTORING
  | typeof READER_RESTORE_PHASE_SETTLED;

/**
 * The reader is "restoring" until the current restore cycle has settled AND the
 * active chapter has a measurement result (ready or failed, not pending) — only
 * then is it safe to publish the visible locator and unmask the article.
 */
export function resolveRestorePhase(input: {
  activeMeasurementStatus: ReaderMeasurementEntry["status"];
  activeRestoreCycleKey: string;
  settledRestoreCycleKey: string | null;
}): ReaderRestorePhase {
  if (
    input.settledRestoreCycleKey === input.activeRestoreCycleKey &&
    input.activeMeasurementStatus !== "pending"
  ) {
    return READER_RESTORE_PHASE_SETTLED;
  }

  return READER_RESTORE_PHASE_RESTORING;
}
