"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AUTH_TIMEOUT_MS } from "./with-deadline";
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

type Preparation = "preparing" | "waiting" | "failed" | "ready";
type Selection = {
  stamp: string;
  owner: string | null | undefined;
  preparation: Preparation;
};

export function useDeviceIdentity(serverUserId: string | null) {
  const { isLoaded, userId, sessionId } = useAuth();
  const [selection, setSelection] = useState<Selection>({
    stamp: "",
    owner: undefined,
    preparation: "preparing",
  });
  const selectedOwner = useRef<string | null | undefined>(undefined);
  const activeStamp = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [waitingStamp, setWaitingStamp] = useState<string | null>(null);
  useEffect(() => {
    const changed = () => {
      // Sign-out can arrive before React commits its next account render.
      activeStamp.current = null;
      setRevision((value) => value + 1);
    };
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
  const stamp = JSON.stringify([
    isLoaded,
    userId,
    sessionId,
    serverUserId,
    blocked,
    revision,
  ]);
  // Commit the fence before passive cleanup: an old promise may settle between
  // the account render and the next reconciliation effect.
  useLayoutEffect(() => {
    activeStamp.current = stamp;
    return () => {
      activeStamp.current = null;
    };
  }, [stamp]);
  useEffect(() => {
    let cancelled = false;
    const currentEffect = () => !cancelled && activeStamp.current === stamp;
    if (blocked) return;
    async function reconcile() {
      try {
        if (isDeviceTransitionPending() && !isLoaded) return;
        const previous = getActiveUserId();
        const current = isLoaded
          ? (userId ?? previous)
          : (previous ?? serverUserId);
        if (
          current &&
          decideIdentityAction(previous, current).kind === "adopt"
        ) {
          // Discard old closures before adopting another account's database.
          if (selectedOwner.current) {
            beginDeviceTransition();
            return;
          }
        }
        await selectDeviceOwner(current);
        if (!currentEffect()) return;
        finishDeviceTransition();
        if (isLoaded && userId && sessionId) {
          if (readSignOutIntent()) clearSignOutIntent();
          try {
            localStorage.setItem(SESSION_KEY, sessionId);
          } catch {
            /* Storage denied. */
          }
        }
        selectedOwner.current = current;
        setSelection({ stamp, owner: current, preparation: "ready" });
      } catch {
        if (currentEffect())
          setSelection({ stamp, owner: undefined, preparation: "failed" });
      }
    }
    void reconcile();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, sessionId, blocked, serverUserId, stamp]);
  const owner = blocked ? null : selection.owner;
  const expected = isLoaded ? userId : serverUserId;
  const changing = !!(expected && expected !== owner);
  const previous = getActiveUserId();
  const target = isLoaded ? (userId ?? previous) : (previous ?? serverUserId);
  // Session refresh/expiry is not another account. Preserve its already-mounted
  // reader while fencing the new reconciliation's side effects separately.
  const ready =
    selection.preparation === "ready" &&
    owner !== undefined &&
    !changing &&
    target === owner &&
    previous === owner &&
    !isDeviceTransitionPending();
  // Selection can finish while Clerk still names a different account. Bound the
  // visible wait for the whole gate, not just the storage promise.
  useEffect(() => {
    if (ready || blocked) return;
    const timer = setTimeout(() => setWaitingStamp(stamp), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, blocked, stamp]);
  const preparation = ready
    ? "ready"
    : selection.stamp === stamp && selection.preparation === "failed"
      ? "failed"
      : waitingStamp === stamp
        ? "waiting"
        : "preparing";
  return { owner, ready, blocked, preparation };
}
