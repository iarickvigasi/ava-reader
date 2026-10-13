import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Exercise the actual hook, gate and serial selector with deterministic passive
// effects. Only Clerk, persistence and React's scheduler are substituted.
const f = vi.hoisted(() => ({
  slots: [] as unknown[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  queued: [] as (() => void)[],
  layouts: [] as (() => void)[],
  index: 0,
  effectIndex: 0,
  active: "old" as string | null,
  auth: {
    isLoaded: true,
    userId: "new" as string | null,
    sessionId: "session-1",
  },
  blocked: false,
  serverUserId: null as string | null,
  transition: false,
  intent: true,
  pathname: "/app",
  adopt: vi.fn<(userId: string) => Promise<void>>(),
  finish: vi.fn(),
  begin: vi.fn(),
  clearIntent: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = f.index++;
    if (!(index in f.slots)) f.slots[index] = initial;
    return [
      f.slots[index],
      (value: unknown) => {
        f.slots[index] =
          typeof value === "function" ? value(f.slots[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = f.index++;
    if (!(index in f.slots)) f.slots[index] = { current: initial };
    return f.slots[index];
  },
  useLayoutEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = f.effectIndex++;
    const previous = f.effects[index];
    if (
      previous &&
      deps.every((value, i) => Object.is(value, previous.deps[i]))
    )
      return;
    f.layouts.push(() => {
      previous?.cleanup?.();
      f.effects[index] = { deps, cleanup: effect() || undefined };
    });
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = f.effectIndex++;
    const previous = f.effects[index];
    if (
      previous &&
      deps.every((value, i) => Object.is(value, previous.deps[i]))
    )
      return;
    f.queued.push(() => {
      previous?.cleanup?.();
      f.effects[index] = { deps, cleanup: effect() || undefined };
    });
  },
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => f.auth }));
vi.mock("next/navigation", () => ({ usePathname: () => f.pathname }));
vi.mock("@/features/offline/db", () => ({
  ACTIVE_USER_STORAGE_KEY: "active-user",
  getActiveUserId: () => f.active,
}));
vi.mock("@/features/offline/lifecycle/clear-all-user-data", () => ({
  adoptUser: (userId: string) => f.adopt(userId),
}));
vi.mock("./device-transition", () => ({
  beginDeviceTransition: () => f.begin(),
  finishDeviceTransition: () => f.finish(),
  isDeviceTransitionPending: () => f.transition,
}));
vi.mock("./local-sign-out", () => ({
  AUTH_CHANGE: "auth-change",
  SESSION_KEY: "last-session",
  isLocallySignedOut: () => f.blocked,
  readSignOutIntent: () => f.intent,
  clearSignOutIntent: () => {
    f.clearIntent();
    f.intent = false;
  },
}));
vi.mock("./local-sign-out-recovery", () => ({
  LocalSignOutRecovery: ({ blocked }: { blocked: boolean }) =>
    blocked ? <p>Signing out</p> : null,
}));
vi.mock("@/features/offline/compatibility/database-access-gate", () => ({
  DatabaseAccessGate: ({ children }: { children: React.ReactNode }) => children,
}));
let Gate: typeof import("../offline/lifecycle/offline-identity-reconciler").OfflineIdentityReconciler;
let writeSession: ReturnType<typeof vi.fn>;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const render = () => {
  f.index = f.effectIndex = 0;
  const markup = renderToStaticMarkup(
    <Gate serverUserId={f.serverUserId}>
      <p>Private account content</p>
    </Gate>,
  );
  f.layouts.splice(0).forEach((run) => run());
  return markup;
};
const effects = async () => {
  f.queued.splice(0).forEach((run) => run());
  await flush();
};
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  f.slots = [];
  f.effects = [];
  f.queued = [];
  f.layouts = [];
  f.active = "old";
  f.auth = { isLoaded: true, userId: "new", sessionId: "session-1" };
  f.serverUserId = null;
  f.blocked = f.transition = false;
  f.intent = true;
  f.pathname = "/app";
  f.adopt.mockReset();
  f.finish.mockReset();
  f.begin.mockReset();
  f.clearIntent.mockReset();
  writeSession = vi.fn();
  vi.stubGlobal("localStorage", { setItem: writeSession });
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), { location: { replace: vi.fn() } }),
  );
  Gate = (await import("../offline/lifecycle/offline-identity-reconciler"))
    .OfflineIdentityReconciler;
});
afterEach(() => {
  f.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("shows preparation then bounded waiting without treating blocked cleanup as complete", async () => {
  const work = deferred();
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    await work.promise;
  });
  expect(render()).toContain("Preparing your library");
  await effects();
  vi.advanceTimersByTime(15_000);
  expect(render()).toContain("still being prepared");
  expect(render()).not.toContain("Private account content");
  expect(f.finish).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
  work.resolve();
  await flush();
  expect(render()).toContain("Private account content");
  expect(writeSession).toHaveBeenCalledWith("last-session", "session-1");
  expect(f.finish).toHaveBeenCalledOnce();
  await effects();
  expect(render()).toContain("Private account content");
  expect(f.adopt).toHaveBeenCalledOnce();
});
it("catches failed cleanup and refuses queued same-target none after a session change", async () => {
  const work = deferred();
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    await work.promise;
  });
  render();
  await effects();
  f.auth.sessionId = "session-2";
  render();
  await effects();
  work.reject(new Error("private storage detail"));
  await flush();
  expect(render()).toContain("could not prepare your library");
  expect(render()).not.toMatch(
    /Private account content|private storage detail|<button|Reload|Retry/,
  );
  expect(f.finish).not.toHaveBeenCalled();
  expect(f.clearIntent).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
  f.auth.sessionId = "session-3";
  render();
  await effects();
  expect(render()).toContain("could not prepare your library");
  expect(f.adopt).toHaveBeenCalledOnce();
  expect(writeSession).not.toHaveBeenCalled();
});
it("fences obsolete account completion before transition and session side effects", async () => {
  const first = deferred();
  const second = deferred();
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    await (userId === "new" ? first : second).promise;
  });
  render();
  await effects();
  f.auth.userId = "other";
  f.auth.sessionId = "session-other";
  expect(render()).not.toContain("Private account content");
  // A changed render must invalidate old work even before passive cleanup runs.
  first.resolve();
  await flush();
  expect(f.finish).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
  await effects();
  expect(render()).not.toContain("Private account content");
  second.resolve();
  await flush();
  expect(render()).toContain("Private account content");
  expect(writeSession.mock.calls).toEqual([["last-session", "session-other"]]);
});
it("keeps sign-out precedence and rejects late-success release", async () => {
  const work = deferred();
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    await work.promise;
  });
  render();
  await effects();
  f.blocked = true;
  expect(render()).toContain("Signing out");
  await effects();
  work.resolve();
  await flush();
  expect(render()).not.toContain("Private account content");
  expect(f.finish).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
});
it("preserves a completed report return through the required post-wipe identity reset", async () => {
  const transition = await vi.importActual<
    typeof import("./device-transition")
  >("./device-transition");
  const target =
    "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=export&eventCursor=events-56&costCursor=cost-4";
  const replace = vi.fn();
  Object.assign(window.location, {
    href: `https://ava.invalid/auth/sso-callback?redirect_url=${encodeURIComponent(target)}`,
    replace,
  });
  vi.stubGlobal("sessionStorage", {
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getItem: () => null,
  });
  f.auth.userId = "old";
  render();
  await effects();
  expect(render()).toContain("Private account content");
  f.blocked = true;
  f.auth.userId = null;
  f.active = null;
  render();
  await effects();
  f.pathname = "/auth/sso-callback";
  f.blocked = false;
  f.auth.userId = "old";
  f.auth.sessionId = "new-session";
  f.begin.mockImplementation(() => transition.beginDeviceTransition());
  writeSession.mockClear();
  render();
  await effects();
  expect(f.begin).toHaveBeenCalledOnce();
  expect(replace).toHaveBeenCalledExactlyOnceWith(target);
  expect(f.adopt).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
  expect(transition.isDeviceTransitionPending()).toBe(true);
  transition.finishDeviceTransition();
});
it.each(["fresh", "refresh"])(
  "does not invent a Home reset for a %s same-owner callback",
  async (mode) => {
    f.active = mode === "fresh" ? null : "old";
    f.auth.userId = "old";
    f.adopt.mockImplementation(async (userId) => {
      f.active = userId;
    });
    f.pathname = "/app/admin/pdf-reports";
    render();
    await effects();
    if (mode === "refresh") {
      f.auth.sessionId = "new-session";
      render();
      await effects();
    }
    expect(render()).toContain("Private account content");
    expect(f.begin).not.toHaveBeenCalled();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(f.adopt.mock.calls).toEqual(mode === "fresh" ? [["old"]] : []);
  },
);
it("keeps a different-owner storage event fenced and routed to Home", async () => {
  f.auth.userId = "old";
  render();
  await effects();
  Object.assign(window.location, {
    href: "https://ava.invalid/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored",
  });
  const event = new Event("storage");
  Object.defineProperties(event, {
    key: { value: "active-user" },
    newValue: { value: "other" },
  });
  window.dispatchEvent(event);
  expect(window.location.replace).toHaveBeenCalledExactlyOnceWith("/app");
  expect(f.begin).not.toHaveBeenCalled();
});
it("keeps public routes open and bounds pending transition waiting for Clerk", async () => {
  f.auth.isLoaded = false;
  f.auth.userId = null;
  f.transition = true;
  render();
  await effects();
  vi.advanceTimersByTime(15_000);
  expect(render()).toContain("still being prepared");
  expect(f.adopt).not.toHaveBeenCalled();
  f.pathname = "/sign-in";
  expect(render()).toContain("Private account content");
});
it("preserves the cached owner when the loaded Clerk session expires", async () => {
  f.active = "new";
  f.auth.userId = null;
  render();
  await effects();
  expect(render()).toContain("Private account content");
  expect(f.adopt).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
});
it("retains the failed-owner guard across remount without retrying adoption", async () => {
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    throw new Error("private failure");
  });
  render();
  await effects();
  expect(render()).toContain("could not prepare your library");
  f.effects.forEach((effect) => effect.cleanup?.());
  f.slots = [];
  f.effects = [];
  f.queued = [];
  f.layouts = [];
  render();
  await effects();
  expect(render()).toContain("could not prepare your library");
  expect(f.adopt).toHaveBeenCalledOnce();
  expect(writeSession).not.toHaveBeenCalled();
});
it("lets a different account complete its own queued cleanup after a failure", async () => {
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    if (userId === "new") throw new Error("private failure");
  });
  render();
  await effects();
  expect(render()).toContain("could not prepare your library");
  f.auth.userId = "other";
  f.auth.sessionId = "session-other";
  render();
  await effects();
  expect(render()).toContain("Private account content");
  expect(f.adopt.mock.calls).toEqual([["new"], ["other"]]);
  expect(writeSession.mock.calls).toEqual([["last-session", "session-other"]]);
});
it("does not finish or stamp a session after unmount, even if cleanup later succeeds", async () => {
  const work = deferred();
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    await work.promise;
  });
  render();
  await effects();
  f.effects.forEach((effect) => effect.cleanup?.());
  expect(vi.getTimerCount()).toBe(0);
  work.resolve();
  await flush();
  expect(f.finish).not.toHaveBeenCalled();
  expect(f.clearIntent).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
});
it("keeps ready same-owner children mounted through session, expiry and readiness changes", async () => {
  f.active = "new";
  render();
  await effects();
  expect(render()).toContain("Private account content");
  for (const auth of [
    { isLoaded: true, userId: "new", sessionId: "session-2" },
    { isLoaded: true, userId: null, sessionId: "session-2" },
    { isLoaded: false, userId: null, sessionId: "session-2" },
    { isLoaded: true, userId: "new", sessionId: "session-3" },
  ]) {
    f.auth = auth;
    expect(render()).toContain("Private account content");
    await effects();
    expect(render()).toContain("Private account content");
  }
  window.dispatchEvent(new Event("auth-change"));
  expect(render()).toContain("Private account content");
  await effects();
  expect(render()).toContain("Private account content");
  expect(f.adopt).not.toHaveBeenCalled();
});
it("permits a failed target only after a real different-owner adoption, not its stamped marker", async () => {
  let fail = true;
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    if (userId === "new" && fail) throw new Error("private failure");
  });
  const { selectDeviceOwner } = await import("./select-device-owner");
  await expect(selectDeviceOwner("new")).rejects.toThrow();
  await expect(selectDeviceOwner("new")).rejects.toThrow();
  await expect(selectDeviceOwner(null)).rejects.toThrow();
  expect(f.adopt).toHaveBeenCalledTimes(1);
  await selectDeviceOwner("other");
  fail = false;
  await selectDeviceOwner("new");
  await selectDeviceOwner("new");
  expect(f.adopt.mock.calls).toEqual([["new"], ["other"], ["new"]]);
});
it("fences sign-out notification immediately, before the next render commits", async () => {
  const work = deferred();
  f.adopt.mockImplementation(async (userId) => {
    f.active = userId;
    await work.promise;
  });
  render();
  await effects();
  f.blocked = true;
  window.dispatchEvent(new Event("auth-change"));
  work.resolve();
  await flush();
  expect(f.finish).not.toHaveBeenCalled();
  expect(f.clearIntent).not.toHaveBeenCalled();
  expect(writeSession).not.toHaveBeenCalled();
  expect(render()).toContain("Signing out");
  expect(render()).not.toContain("Private account content");
});
it("closes previously ready content if its actual device owner was cleared or replaced", async () => {
  f.active = "new";
  render();
  await effects();
  expect(render()).toContain("Private account content");
  f.active = null;
  expect(render()).not.toContain("Private account content");
  await effects();
  f.active = "other";
  expect(render()).not.toContain("Private account content");
});
it("bounds the whole gate while loaded storage and unresolved server account differ", async () => {
  f.active = "old";
  f.serverUserId = "new";
  f.auth.isLoaded = false;
  f.auth.userId = null;
  render();
  await effects();
  expect(render()).not.toContain("Private account content");
  await effects();
  vi.advanceTimersByTime(15_000);
  expect(render()).toContain("still being prepared");
  expect(render()).not.toContain("Private account content");
  expect(f.adopt).not.toHaveBeenCalled();
});
