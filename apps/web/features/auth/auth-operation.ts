import { AUTH_TIMEOUT_MS } from "./with-deadline";

export type AuthOperationState = "idle" | "pending" | "timed-out";

// A timed-out SDK promise cannot be aborted; keep its lock until page reload.
export function createAuthOperation(
  ready: boolean,
  changed: (state: AuthOperationState) => void,
  failed: () => void,
) {
  let mounted = true;
  let locked = false;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = () => mounted && !expired;
  return {
    setReady(value: boolean) {
      ready = value;
    },
    mount() {
      mounted = true;
      if (locked && expired) changed("timed-out");
    },
    dispose() {
      mounted = false;
      if (locked) expired = true;
      clearTimeout(timer);
    },
    current,
    locked: () => locked,
    canCall: () => current() && ready,
    async run(loaded: boolean, work: () => Promise<void>) {
      if (!loaded || !ready || !mounted || locked) return;
      locked = true;
      expired = false;
      changed("pending");
      timer = setTimeout(() => {
        expired = true;
        if (mounted) changed("timed-out");
      }, AUTH_TIMEOUT_MS);
      try {
        await work();
      } catch {
        if (current()) failed();
      } finally {
        clearTimeout(timer);
        if (!expired) {
          locked = false;
          if (mounted) changed("idle");
        }
      }
    },
  };
}
