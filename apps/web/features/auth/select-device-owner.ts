import { getActiveUserId } from "@/features/offline/db";
import { adoptUser } from "@/features/offline/lifecycle/clear-all-user-data";
import { decideIdentityAction } from "@/features/offline/lifecycle/identity-action";

let selecting: Promise<void> = Promise.resolve();
// adoptUser stamps the owner before cleanup. A rejected cleanup cannot become a
// successful no-op on a later render or remount in this page lifetime.
const failedOwners = new Set<string>();

// Clerk readiness can change during Dexie cleanup. Serialize selection so no
// later render starts hydrating while an earlier adoption is still purging.
export function selectDeviceOwner(userId: string | null): Promise<void> {
  selecting = selecting
    .catch(() => undefined)
    .then(async () => {
      const previous = getActiveUserId();
      const target = userId ?? previous;
      const action = decideIdentityAction(previous, userId);
      if (action.kind === "none" && target && failedOwners.has(target))
        throw new Error("Device owner preparation failed");
      if (action.kind === "adopt") {
        try {
          await adoptUser(action.userId);
          failedOwners.delete(action.userId);
        } catch (error) {
          failedOwners.add(action.userId);
          throw error;
        }
      }
    });
  return selecting;
}
