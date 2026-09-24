"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDeviceIdentity } from "@/features/auth/use-device-identity";
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
        <Fragment key={owner ?? "visitor"}>{children}</Fragment>
      )}
    </>
  );
}
