"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readSignOutIntent } from "./local-sign-out";
import { finishDeviceSignOut } from "./finish-device-sign-out";

export function LocalSignOutRecovery({ blocked }: { blocked: boolean }) {
  const clerk = useClerk();
  const pathname = usePathname();
  useEffect(() => {
    if (!readSignOutIntent()) return;
    let running = false;
    let stopped = false;
    async function revoke() {
      if (running || stopped) return;
      running = true;
      try {
        await finishDeviceSignOut(clerk);
      } catch {
        /* Durable intent blocks access and retries incomplete cleanup/revocation. */
      } finally {
        running = false;
        if (!stopped && blocked && pathname.startsWith("/app"))
          window.location.replace("/sign-in");
      }
    }
    void revoke();
    const timer = setInterval(() => void revoke(), 30_000);
    window.addEventListener("online", revoke);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", revoke);
    };
  }, [blocked, clerk, clerk.loaded, clerk.session?.id, pathname]);
  return null;
}
