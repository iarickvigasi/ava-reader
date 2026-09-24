import type { useClerk } from "@clerk/nextjs";
import { getActiveUserId } from "@/features/offline/db";
import { wipeUserData } from "@/features/offline/lifecycle/clear-all-user-data";
import {
  isLocallySignedOut,
  markSignedOut,
  readSignOutIntent,
} from "./local-sign-out";
import { withDeadline } from "./with-deadline";

type Clerk = Pick<
  ReturnType<typeof useClerk>,
  "loaded" | "user" | "session" | "signOut"
>;

export async function finishDeviceSignOut(clerk: Clerk) {
  const intent = readSignOutIntent();
  if (!intent) return;
  const matches = () =>
    isLocallySignedOut(clerk.user?.id ?? intent.userId, clerk.session?.id);
  if (matches() && getActiveUserId() === intent.userId)
    await wipeUserData(intent.userId);
  // Check again after cleanup: a late completion must never revoke a new session.
  if (navigator.onLine && clerk.loaded && clerk.session && matches()) {
    await withDeadline(clerk.signOut({ sessionId: clerk.session.id }));
    if (!intent.sessionId) markSignedOut(intent.userId, "signed-out");
  } else if (clerk.loaded && !clerk.session && !intent.sessionId) {
    markSignedOut(intent.userId, "signed-out");
  }
}
