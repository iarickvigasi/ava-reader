import { vi } from "vitest";
import { setActiveUser } from "@/features/offline/db";
import { getAccountToken } from "./get-account-token";

export function createRecoveryAccount(userId: string) {
  const storage = new Map<string, string>();
  const runtime = {
    loaded: false,
    user: { id: userId },
    session: { id: "session" },
  };
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", {
    Clerk: runtime,
    location: { href: "https://avareader.space/app" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  setActiveUser(userId);
  const token = vi.fn(async () => "same-account-token");
  return { runtime, token, getToken: () => getAccountToken(userId, token) };
}
