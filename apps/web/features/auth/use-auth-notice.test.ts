import { afterEach, beforeEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({
  clerk: { loaded: true, status: "degraded" },
  signedIn: true,
  online: true,
  owner: "reader",
  value: undefined as unknown,
  effect: undefined as undefined | (() => void | (() => void)),
  deps: [] as unknown[],
  cleanup: undefined as undefined | (() => void),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: harness.signedIn }),
  useClerk: () => harness.clerk,
}));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => harness.owner,
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => harness.online,
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    harness.value ??= initial;
    return [
      harness.value,
      (value: unknown) => Object.assign(harness, { value }),
    ];
  },
  useEffect: (effect: typeof harness.effect, deps: unknown[]) => {
    if (deps.some((value, index) => value !== harness.deps[index])) {
      harness.effect = effect;
      harness.deps = deps;
    }
  },
}));
import { useAuthNotice as readNotice } from "./use-auth-notice";
function renderNotice() {
  readNotice();
  const result = readNotice();
  if (harness.effect) {
    harness.cleanup?.();
    harness.cleanup = harness.effect() || undefined;
    harness.effect = undefined;
  }
  return result;
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(harness, {
    clerk: { loaded: true, status: "degraded" },
    signedIn: true,
    online: true,
    owner: "reader",
    value: undefined,
    deps: [],
  });
});
afterEach(() => {
  harness.cleanup?.();
  vi.useRealTimers();
});
it("hides after six seconds without restarting its timer on rerender", () => {
  renderNotice();
  vi.advanceTimersByTime(5_000);
  expect(renderNotice().visible).toBe(true);
  vi.advanceTimersByTime(1_000);
  expect(renderNotice().visible).toBe(false);
});
it("keeps manual dismissal through offline and restoring states", () => {
  renderNotice().dismiss();
  harness.online = false;
  renderNotice();
  harness.online = true;
  harness.clerk = { loaded: false, status: "loading" };
  renderNotice();
  harness.clerk = { loaded: true, status: "degraded" };
  expect(renderNotice().visible).toBe(false);
});
it("allows a new notice after authenticated recovery or account change", () => {
  renderNotice().dismiss();
  harness.clerk.status = "ready";
  renderNotice();
  harness.clerk.status = "error";
  expect(renderNotice().visible).toBe(true);
  renderNotice().dismiss();
  harness.owner = "another-reader";
  expect(renderNotice().visible).toBe(true);
});
it("keeps sign-in required visible after dismissal and beyond the timeout", () => {
  renderNotice().dismiss();
  harness.clerk.status = "ready";
  harness.signedIn = false;
  expect(renderNotice()).toMatchObject({
    visible: true,
    state: "sign-in-required",
  });
  vi.advanceTimersByTime(60_000);
  expect(renderNotice().visible).toBe(true);
});
