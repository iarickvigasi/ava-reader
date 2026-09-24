import {
  getActiveUserId,
  ACTIVE_USER_STORAGE_KEY,
} from "@/features/offline/db";
import { isLocallySignedOut } from "./local-sign-out";
import { withDeadline } from "./with-deadline";

export async function getAccountToken(
  userId: string | null | undefined,
  getToken: () => Promise<string | null>,
): Promise<string | null> {
  const ownsSession = () => {
    if (!userId || typeof window === "undefined" || !navigator.onLine)
      return false;
    const clerk = (
      window as Window & {
        Clerk?: {
          loaded: boolean;
          user?: { id: string } | null;
          session?: { id: string } | null;
        };
      }
    ).Clerk;
    if (
      !clerk?.loaded ||
      clerk.user?.id !== userId ||
      getActiveUserId() !== userId
    )
      return false;
    if (isLocallySignedOut(userId, clerk.session?.id)) return false;
    try {
      const storedOwner = window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      if (storedOwner && storedOwner !== userId) return false;
    } catch {
      /* In-memory ownership remains authoritative when storage is blocked. */
    }
    return true;
  };
  if (!ownsSession()) return null;
  try {
    const token = await withDeadline(getToken());
    return ownsSession() ? token : null;
  } catch {
    return null;
  }
}
