"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  ACTIVE_USER_STORAGE_KEY,
  getActiveUserId,
} from "@/features/offline/db";
import { decideIdentityAction } from "@/features/offline/lifecycle/identity-action";
import { selectDeviceOwner } from "./select-device-owner";
import {
  AUTH_CHANGE,
  clearSignOutIntent,
  readSignOutIntent,
  isLocallySignedOut,
  SESSION_KEY,
} from "./local-sign-out";

import {
  beginDeviceTransition,
  finishDeviceTransition,
  isDeviceTransitionPending,
} from "./device-transition";

export function useDeviceIdentity(serverUserId: string | null) {
  const { isLoaded, userId, sessionId } = useAuth();
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    const storage = (event: StorageEvent) => {
      if (
        event.key === ACTIVE_USER_STORAGE_KEY &&
        event.newValue &&
        event.newValue !== getActiveUserId()
      )
        window.location.replace("/app");
      changed();
    };
    window.addEventListener(AUTH_CHANGE, changed);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(AUTH_CHANGE, changed);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const blocked = isLocallySignedOut(
    userId ?? serverUserId ?? getActiveUserId(),
    sessionId,
  );
  useEffect(() => {
    let cancelled = false;
    async function reconcile() {
      if (blocked) {
        setOwner(null);
        return;
      }
      if (isDeviceTransitionPending() && !isLoaded) return;
      const previous = getActiveUserId();
      const current = isLoaded
        ? (userId ?? previous)
        : (previous ?? serverUserId);
      if (current && decideIdentityAction(previous, current).kind === "adopt") {
        // Discard old closures before adopting another account's database.
        if (owner) {
          beginDeviceTransition();
          return;
        }
      }
      await selectDeviceOwner(current);
      finishDeviceTransition();
      if (isLoaded && userId && sessionId) {
        if (readSignOutIntent()) clearSignOutIntent();
        try {
          localStorage.setItem(SESSION_KEY, sessionId);
        } catch {
          /* Storage denied. */
        }
      }
      if (!cancelled) setOwner(current);
    }
    void reconcile();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, sessionId, blocked, revision, owner, serverUserId]);
  const expected = isLoaded ? userId : serverUserId;
  const changing = !!(expected && expected !== owner);
  return { owner, ready: owner !== undefined && !changing, blocked };
}
