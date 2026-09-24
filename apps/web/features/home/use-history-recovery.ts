import { useEffect, useEffectEvent } from "react";

export function useHistoryRecovery(
  status: string,
  ready: boolean,
  load: () => Promise<void>,
) {
  const recover = useEffectEvent(() => {
    if (status === "error" && ready && navigator.onLine) void load();
  });
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") recover();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    const timer = setTimeout(() => recover(), 30_000);
    if (ready) recover();
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
    // Changing readiness retries immediately; ordinary failures wait for backoff.
  }, [ready]);
  useEffect(() => {
    if (status !== "error") return;
    const timer = setTimeout(() => recover(), 30_000);
    return () => clearTimeout(timer);
  }, [status]);
}
