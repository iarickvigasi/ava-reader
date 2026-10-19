import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  expired: false,
  effect: undefined as undefined | (() => void | (() => void)),
}));
vi.mock("react", () => ({
  useState: () => [
    state.expired,
    (value: boolean) => {
      state.expired = value;
    },
  ],
  useEffect: (effect: typeof state.effect) => {
    state.effect = effect;
  },
}));
import { useAuthReadiness } from "./use-auth-readiness";
import { AUTH_TIMEOUT_MS } from "./with-deadline";
beforeEach(() => {
  vi.useFakeTimers();
  state.expired = false;
});
afterEach(() => vi.useRealTimers());
it("bounds bootstrap without faking SDK readiness and clears its timer on unmount", () => {
  expect(useAuthReadiness(false)).toBe("loading");
  const cleanup = state.effect?.();
  vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
  expect(useAuthReadiness(false)).toBe("unavailable");
  expect(useAuthReadiness(true)).toBe("ready");
  if (typeof cleanup === "function") cleanup();
  state.expired = false;
  useAuthReadiness(false);
  const stop = state.effect?.();
  if (typeof stop === "function") stop();
  vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
  expect(state.expired).toBe(false);
});
