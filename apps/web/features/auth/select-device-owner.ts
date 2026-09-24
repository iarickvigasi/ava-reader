import { getActiveUserId } from "@/features/offline/db";
import { adoptUser } from "@/features/offline/lifecycle/clear-all-user-data";
import { decideIdentityAction } from "@/features/offline/lifecycle/identity-action";

let selecting: Promise<void> = Promise.resolve();

// Clerk readiness can change during Dexie cleanup. Serialize selection so no
// later render starts hydrating while an earlier adoption is still purging.
export function selectDeviceOwner(userId: string | null): Promise<void> {
  selecting = selecting
    .catch(() => undefined)
    .then(async () => {
      const action = decideIdentityAction(getActiveUserId(), userId);
      if (action.kind === "adopt") await adoptUser(action.userId);
    });
  return selecting;
}
