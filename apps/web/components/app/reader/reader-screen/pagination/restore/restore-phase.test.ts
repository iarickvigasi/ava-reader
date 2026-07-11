import { describe, expect, it } from "vitest";
import {
  READER_RESTORE_PHASE_RESTORING,
  READER_RESTORE_PHASE_SETTLED,
  resolveRestorePhase,
} from "./restore-phase";

describe("resolveRestorePhase", () => {
  it("settles only when the cycle key matches and measurement is not pending", () => {
    expect(
      resolveRestorePhase({
        activeMeasurementStatus: "ready",
        activeRestoreCycleKey: "restore:key",
        settledRestoreCycleKey: "restore:key",
      }),
    ).toBe(READER_RESTORE_PHASE_SETTLED);

    expect(
      resolveRestorePhase({
        activeMeasurementStatus: "pending",
        activeRestoreCycleKey: "restore:key",
        settledRestoreCycleKey: "restore:key",
      }),
    ).toBe(READER_RESTORE_PHASE_RESTORING);
  });

  it("stays restoring when the settled cycle key does not match", () => {
    expect(
      resolveRestorePhase({
        activeMeasurementStatus: "ready",
        activeRestoreCycleKey: "restore:next",
        settledRestoreCycleKey: "restore:key",
      }),
    ).toBe(READER_RESTORE_PHASE_RESTORING);
  });
});
