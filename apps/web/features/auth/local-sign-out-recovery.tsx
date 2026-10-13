"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isLocallySignedOut, readSignOutIntent } from "./local-sign-out";
import { finishDeviceSignOut } from "./finish-device-sign-out";
import { signOutReturnTarget } from "./sign-out-return-target";

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
        const intent = readSignOutIntent();
        if (
          !stopped &&
          blocked &&
          intent &&
          pathname.startsWith("/app") &&
          isLocallySignedOut(clerk.user?.id ?? intent.userId, clerk.session?.id)
        )
          window.location.replace(signOutReturnTarget(window.location.href));
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
