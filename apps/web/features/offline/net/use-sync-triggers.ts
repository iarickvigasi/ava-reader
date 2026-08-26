// The usual offline-sync triggers, shared by every flush/drain runner: fires
// `run` when the network comes back (`online` event) and when the tab regains
// visibility (mobile suspends fetches in the background). Pass null while the
// consumer isn't ready (auth still loading, feature disabled) — no listeners
// are attached. `kickOnAttach` also fires `run` once immediately, for queues
// that may hold work left over from a prior session.
//
// `run` must be referentially stable (wrap it in useCallback) — a fresh
// identity per render would detach and re-attach the listeners every render.

import { useEffect } from "react";

export function useSyncTriggers(
  run: (() => void) | null,
  opts?: { kickOnAttach?: boolean },
): void {
  const kickOnAttach = opts?.kickOnAttach ?? false;

  useEffect(() => {
    if (!run) {
      return;
    }
    const runWhenVisible = () => {
      if (document.visibilityState === "visible") {
        run();
      }
    };
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", runWhenVisible);
    if (kickOnAttach) {
      run();
    }
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", runWhenVisible);
    };
  }, [run, kickOnAttach]);
}
