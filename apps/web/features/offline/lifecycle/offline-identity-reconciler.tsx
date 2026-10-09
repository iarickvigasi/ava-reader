"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDeviceIdentity } from "@/features/auth/use-device-identity";
import { DeviceOwnerContext } from "./device-owner-context";
import { DatabaseAccessGate } from "../compatibility/database-access-gate";
import { LocalSignOutRecovery } from "@/features/auth/local-sign-out-recovery";

// Expiry preserves the device owner. Gate hydration until its DB is selected,
// and remount all account-owned views when the identity changes.
export function OfflineIdentityReconciler({
  children,
  serverUserId,
}: {
  children: ReactNode;
  serverUserId: string | null;
}) {
  const { owner, ready, blocked } = useDeviceIdentity(serverUserId);
  const pathname = usePathname();
  return (
    <>
      <LocalSignOutRecovery blocked={blocked} />
      {(!pathname.startsWith("/app") || (ready && !blocked)) && (
        <Fragment key={owner ?? "visitor"}>
          <DeviceOwnerContext value={owner ?? null}>
            {pathname.startsWith("/app") ? (
              <DatabaseAccessGate>{children}</DatabaseAccessGate>
            ) : (
              children
            )}
          </DeviceOwnerContext>
        </Fragment>
      )}
    </>
  );
}
