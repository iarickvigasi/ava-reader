import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
const observed = vi.hoisted(() => ({
  loaded: false,
  expired: false,
  effect: undefined as undefined | (() => void | (() => void)),
}));
vi.mock("react", async (importActual) => ({
  ...(await importActual<typeof import("react")>()),
  useState: () => [
    observed.expired,
    (value: boolean) => {
      observed.expired = value;
    },
  ],
  useEffect: (effect: typeof observed.effect) => {
    observed.effect = effect;
  },
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: observed.loaded }),
  AuthenticateWithRedirectCallback: () => null,
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { SsoCallbackHandler } from "./sso-callback-handler";
import { AuthReadinessNotice } from "./auth-readiness-notice";
import { AUTH_TIMEOUT_MS } from "@/features/auth/with-deadline";
function containsCallback(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(containsCallback);
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return (
    node.type === AuthenticateWithRedirectCallback ||
    containsCallback(node.props.children)
  );
}
function notice(node: ReactNode): { operation: string } | undefined {
  if (Array.isArray(node)) return node.map(notice).find(Boolean);
  if (!isValidElement<{ children?: ReactNode; operation: string }>(node))
    return;
  if (node.type === AuthReadinessNotice) return node.props;
  return notice(node.props.children);
}
beforeEach(() => {
  vi.useFakeTimers();
  observed.loaded = false;
  observed.expired = false;
});
afterEach(() => vi.useRealTimers());
it("starts a callback deadline even when the SDK never loads and clears it on unmount", () => {
  const initial = SsoCallbackHandler();
  expect(notice(initial)?.operation).toBe("idle");
  expect(containsCallback(initial)).toBe(false);
  const cleanup = observed.effect?.();
  vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
  expect(notice(SsoCallbackHandler())?.operation).toBe("timed-out");
  if (typeof cleanup === "function") cleanup();
  observed.expired = false;
  SsoCallbackHandler();
  const stop = observed.effect?.();
  if (typeof stop === "function") stop();
  vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
  expect(observed.expired).toBe(false);
});
it("unmounts a stalled callback UI without claiming to abort underlying SDK work", () => {
  observed.loaded = true;
  const initial = SsoCallbackHandler();
  expect(notice(initial)?.operation).toBe("pending");
  expect(containsCallback(initial)).toBe(true);
  const cleanup = observed.effect?.();
  vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
  const expired = SsoCallbackHandler();
  expect(notice(expired)?.operation).toBe("timed-out");
  expect(containsCallback(expired)).toBe(false);
  if (typeof cleanup === "function") cleanup();
});
