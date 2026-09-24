import { afterEach, expect, it, vi } from "vitest";
import {
  clearSignOutIntent,
  isLocallySignedOut,
  markSignedOut,
  SIGN_OUT_KEY,
} from "./local-sign-out";
afterEach(() => vi.unstubAllGlobals());
it("persists sign-out across tabs without blocking a fresh same-account session", () => {
  const entries = new Map<string, string>();
  const target = Object.assign(new EventTarget(), {
    localStorage: {
      removeItem: (key: string) => entries.delete(key),
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    },
  });
  vi.stubGlobal("window", target);
  const changed = vi.fn();
  target.addEventListener("ava-reader:auth-change", changed);
  markSignedOut("a", "old-session");
  expect(changed).toHaveBeenCalledOnce();
  expect(entries.has(SIGN_OUT_KEY)).toBe(true);
  expect(isLocallySignedOut("a", "old-session")).toBe(true);
  expect(isLocallySignedOut("a")).toBe(true);
  expect(isLocallySignedOut("a", "new-session")).toBe(false);
  expect(isLocallySignedOut("b", "other-session")).toBe(false);
  entries.set(
    SIGN_OUT_KEY,
    JSON.stringify({ userId: "b", sessionId: "other-session" }),
  );
  expect(isLocallySignedOut("b", "other-session")).toBe(true);
  clearSignOutIntent();
  expect(isLocallySignedOut("a")).toBe(false);
  expect(isLocallySignedOut("b")).toBe(false);
});
