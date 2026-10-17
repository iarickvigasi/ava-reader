import { getActiveUserId } from "@/features/offline/db";
import { isLocallySignedOut } from "@/features/auth/local-sign-out";

export function resourceOwnerIsCurrent(userId: string | null | undefined) {
  if (!userId || typeof window === "undefined" || getActiveUserId() !== userId)
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
  return Boolean(
    clerk?.loaded &&
    clerk.user?.id === userId &&
    !isLocallySignedOut(userId, clerk.session?.id),
  );
}
