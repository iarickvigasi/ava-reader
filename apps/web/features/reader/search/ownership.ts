import {
  getActiveUserId,
  getDb,
  type AvaReaderDB,
} from "@/features/offline/db";
import { databaseAccess } from "@/features/offline/compatibility/database-access";
import { isLocallySignedOut } from "@/features/auth/local-sign-out";
import { isDeviceTransitionPending } from "@/features/auth/device-transition";

export function ownsLocalSearch(
  binding: { owner: string | null; db: AvaReaderDB | null },
  mountedOwner: string | null,
  clerkUser: string | null | undefined,
  sessionId?: string | null,
) {
  if (
    !binding.owner ||
    !binding.db ||
    mountedOwner !== binding.owner ||
    getActiveUserId() !== binding.owner ||
    getDb() !== binding.db ||
    (clerkUser && clerkUser !== binding.owner) ||
    isLocallySignedOut(binding.owner, sessionId) ||
    isDeviceTransitionPending()
  )
    return false;
  const access = databaseAccess(binding.db).state;
  return access === "ready";
}
