import { clerkRecoveryAdapter } from "./clerk-recovery-adapter";
import type { ClerkRecoverySource } from "./clerk-recovery-types";
import { retryClerkInitialization } from "./retry-clerk-initialization";

// @clerk/nextjs 7 / @clerk/react 6: this is the provider's initialization path.
// Keep this internal SDK seam isolated and regression-test when upgrading Clerk.
export function startClerkRecovery(source: ClerkRecoverySource) {
  const adapter = clerkRecoveryAdapter(source);
  if (!adapter) {
    console.warn(
      "Clerk recovery adapter is unavailable; check the installed SDK contract.",
    );
    return () => {};
  }
  const clerk = adapter;
  let stopped = false;
  let running = false;
  let delay = 1_000;
  let timer: ReturnType<typeof setTimeout>;
  async function retry() {
    clearTimeout(timer);
    if (stopped || running || clerk.loaded) return;
    if (
      navigator.onLine &&
      document.visibilityState === "visible" &&
      clerk.status === "error"
    ) {
      running = true;
      try {
        await retryClerkInitialization(clerk);
      } catch {
        /* Provider remains unavailable; retry without dropping local data. */
      } finally {
        running = false;
      }
      delay = Math.min(delay * 2, 30_000);
    }
    if (!stopped && !clerk.loaded)
      timer = setTimeout(() => void retry(), delay);
  }
  function wake() {
    delay = 1_000;
    void retry();
  }
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", wake);
  void retry();
  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("online", wake);
    document.removeEventListener("visibilitychange", wake);
  };
}
