import { getAccountToken } from "@/features/auth/get-account-token";
import { getActiveUserId } from "../../../db";

export async function getCoverToken() {
  if (typeof window === "undefined") return null;
  const session = (
    window as Window & {
      Clerk?: { session?: { getToken: () => Promise<string | null> } | null };
    }
  ).Clerk?.session;
  if (!session) return null;
  return getAccountToken(getActiveUserId(), () => session.getToken());
}
