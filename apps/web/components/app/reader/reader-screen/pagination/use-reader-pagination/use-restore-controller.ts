import {
  resolveRestorePhase,
  type ReaderRestorePhase,
} from "./use-restore-controller/restore-phase";
import { useRestoreDecision } from "./use-restore-controller/use-restore-decision";
import { useSettleRestoreCycle } from "./use-restore-controller/use-settle-restore-cycle";
import type { UseRestoreControllerInput } from "./use-restore-controller/use-restore-controller.types";

/**
 * Orchestrates restore: runs the decision machinery (useRestoreDecision) and
 * exposes the restore phase (restoring → settled) that gates locator publishing
 * and article masking.
 */
export function useRestoreController(
  input: UseRestoreControllerInput,
): ReaderRestorePhase {
  const { cancelSettle, scheduleSettle, settledRestoreCycleKey } =
    useSettleRestoreCycle();

  useRestoreDecision({ ...input, cancelSettle, scheduleSettle });

  return resolveRestorePhase({
    activeMeasurementStatus: input.activeMeasurementEntry?.status ?? "pending",
    activeRestoreCycleKey: input.activeRestoreCycleKey,
    settledRestoreCycleKey,
  });
}
