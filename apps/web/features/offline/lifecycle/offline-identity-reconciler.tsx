"use client";

// Render-less root island (adr/5, spec 15). Watches the Clerk session and keeps
// offline data isolated per user on a shared browser profile:
// - sets the active user so getDb() opens THEIR database (`ava-reader-<userId>`);
// - on sign-out, wipes their data across every substrate (DB + SW caches +
//   localStorage);
// - on a different user (account switch, or cold start as someone else), purges
//   every other account's data from this profile.
//
// Mounted at the *root* layout (above /app) so it stays mounted across the
// signed-in → signed-out transition — the /app layout unmounts on sign-out, so
// a watcher there would miss it. Covers both Clerk's <UserButton> menu (opaque
// to us) and our own signOut() call: watching userId is the universal trigger.
// Identity can only change online, so the persisted marker is always correct
// offline; online, a mismatch is reconciled within the same load.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { getActiveUserId, setActiveUser } from "../db";
import { adoptUser, wipeUserData } from "./clear-all-user-data";
import { decideIdentityAction } from "./identity-action";

export function OfflineIdentityReconciler() {
  const { isLoaded, userId } = useAuth();
  // Guards against re-entrancy while an async wipe/adopt is in flight.
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || runningRef.current) {
      return;
    }
    // Who owns the data on disk (persisted from a prior session), vs who's
    // signed in now.
    const previous = getActiveUserId();
    const current = userId ?? null;
    const action = decideIdentityAction(previous, current);

    if (action.kind === "none") {
      // Same-user reload (or never signed in): just ensure the active user is
      // set so getDb() opens the right DB. Idempotent.
      if (current) {
        setActiveUser(current);
      }
      return;
    }

    runningRef.current = true;
    const run =
      action.kind === "wipe"
        ? wipeUserData(action.userId)
        : adoptUser(action.userId);
    void run.finally(() => {
      runningRef.current = false;
    });
  }, [isLoaded, userId]);

  return null;
}
