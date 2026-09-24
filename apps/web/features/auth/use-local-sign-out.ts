"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { getActiveUserId } from "@/features/offline/db";
import { markSignedOut, SESSION_KEY } from "./local-sign-out";
import { hasPendingChanges } from "./has-pending-changes";

export function useLocalSignOut() {
  const clerk = useClerk();
  const t = useTranslations("auth.device");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const userId = getActiveUserId() ?? clerk.user?.id;
      if (!userId) return;
      if ((await hasPendingChanges()) && !window.confirm(t("unsyncedWarning")))
        return;
      let sessionId = clerk.session?.id ?? null;
      try {
        sessionId ??= localStorage.getItem(SESSION_KEY);
      } catch {
        /* Storage denied. */
      }
      markSignedOut(userId, sessionId);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return { signOut, busy, error };
}
