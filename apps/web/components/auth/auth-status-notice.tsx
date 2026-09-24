"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { getActiveUserId } from "@/features/offline/db";
import { resolveAuthState } from "@/features/auth/auth-state";

export function AuthStatusNotice() {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const online = useNetworkState();
  const t = useTranslations("auth.device");
  const state = resolveAuthState({
    online,
    loaded: clerk.loaded,
    status: clerk.status,
    signedIn: isSignedIn,
  });
  if (
    !online ||
    !getActiveUserId() ||
    state === "authenticated" ||
    state === "restoring"
  )
    return null;
  return (
    <aside
      role="status"
      className="fixed right-4 bottom-24 z-40 max-w-xs rounded-card bg-paper p-4 text-sm text-copy shadow-(--shadow-card) md:bottom-4"
    >
      <p>{t(state === "sign-in-required" ? "syncPaused" : "reconnecting")}</p>
      {state === "sign-in-required" && (
        <ButtonLink href="/sign-in" variant="soft" size="sm" className="mt-2">
          {t("signIn")}
        </ButtonLink>
      )}
    </aside>
  );
}
