"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDeviceIdentity } from "@/features/auth/use-device-identity";
import { DeviceOwnerContext } from "./device-owner-context";
import { AppPageSkeleton } from "@/components/app/core/app-page-skeleton";
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
  const { owner, ready, blocked, preparation } =
    useDeviceIdentity(serverUserId);
  const pathname = usePathname();
  return (
    <>
      <LocalSignOutRecovery blocked={blocked} />
      {pathname.startsWith("/app") && !ready && !blocked && (
        preparation === "waiting" || preparation === "failed" ? (
          <main
            className="mx-auto max-w-lg space-y-4 p-6 text-ink"
            role={preparation === "failed" ? "alert" : "status"}
          >
            <h1 className="font-reader text-2xl text-title">
              {preparation === "failed"
                ? "AVA could not prepare your library"
                : "Preparing your library…"}
            </h1>
            <p>
              {preparation === "failed"
                ? "Account preparation did not finish. Your library remains closed to prevent showing another account’s data."
                : "Your library is still being prepared. Another AVA tab may be holding local storage open. You can close other AVA tabs and wait here."}
            </p>
          </main>
        ) : <AppPageSkeleton />
      )}
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
