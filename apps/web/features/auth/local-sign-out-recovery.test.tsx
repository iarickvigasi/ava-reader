import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  pathname: "/app/admin/pdf-reports",
  clerk: { user: { id: "owner" }, session: { id: "old" }, loaded: true },
  finish: vi.fn<() => Promise<void>>(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => f.effects.push(effect),
}));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => f.clerk }));
vi.mock("next/navigation", () => ({ usePathname: () => f.pathname }));
vi.mock("./finish-device-sign-out", () => ({ finishDeviceSignOut: () => f.finish() }));

import { LocalSignOutRecovery } from "./local-sign-out-recovery";
import { clearSignOutIntent, markSignedOut } from "./local-sign-out";

const report =
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=cost";
const replace = vi.fn();
let complete: () => void;
let cleanup: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  f.effects = [];
  f.pathname = "/app/admin/pdf-reports";
  f.clerk = { user: { id: "owner" }, session: { id: "old" }, loaded: true };
  replace.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("window", {
    location: { href: `https://ava.invalid${report}`, replace },
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  markSignedOut("owner", "old");
  f.finish.mockReset().mockImplementation(
    () => new Promise<void>((resolve) => { complete = resolve; }),
  );
  renderToStaticMarkup(<LocalSignOutRecovery blocked />);
  cleanup = f.effects[0]() || undefined;
});
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function settle() {
  complete();
  await Promise.resolve();
  await Promise.resolve();
}

it("retains the validated report after incomplete sign-out recovery", async () => {
  await settle();
  expect(replace).toHaveBeenCalledExactlyOnceWith(
    `/sign-in?${new URLSearchParams({ redirect_url: report })}`,
  );
});
it("does not let an older completion redirect a newly verified session", async () => {
  f.clerk.session = { id: "new" };
  await settle();
  expect(replace).not.toHaveBeenCalled();
});
it("does not redirect after a new identity clears the old intent", async () => {
  clearSignOutIntent();
  await settle();
  expect(replace).not.toHaveBeenCalled();
});
it("does not navigate after its recovery component unmounts", async () => {
  cleanup?.();
  await settle();
  expect(replace).not.toHaveBeenCalled();
});
