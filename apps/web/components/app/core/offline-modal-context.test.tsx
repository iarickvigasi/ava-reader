import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  __resetNetStateForTests,
  checkNetworkReachability,
} from "@/features/offline/net/net-state";
import { hasSeenOfflineModal } from "@/features/offline/notices/seen-modal";
import { OfflineModalProvider } from "./offline-modal-context";

const harness = vi.hoisted(() => ({
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  effects: [] as Array<() => (() => void) | undefined>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const setter = vi.fn();
    harness.setters.push(setter);
    return [initial, setter];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => () => void) => harness.effects.push(effect),
}));
let cleanup: (() => void) | undefined;
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      localStorage: {
        getItem: (key: string) => storage.get(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    }),
  );
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  harness.setters.length = 0;
  harness.effects.length = 0;
  __resetNetStateForTests();
});
afterEach(() => {
  cleanup?.();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});
function mount() {
  OfflineModalProvider({ children: null });
  cleanup = harness.effects[0]();
  return harness.setters[0];
}
it("does not auto-open or mark seen for an API outage, including on mount", async () => {
  const setOpen = mount();
  await checkNetworkReachability();
  expect(setOpen).not.toHaveBeenCalled();
  expect(hasSeenOfflineModal()).toBe(false);
  cleanup?.();
  harness.effects.length = 0;
  harness.setters.length = 0;
  expect(mount()).not.toHaveBeenCalled();
});
it("opens on browser disconnect, closes on reconnect before API recovery, and stays seen", async () => {
  const setOpen = mount();
  vi.stubGlobal("navigator", { onLine: false });
  window.dispatchEvent(new Event("offline"));
  expect(setOpen).toHaveBeenLastCalledWith(true);
  expect(hasSeenOfflineModal()).toBe(true);
  vi.stubGlobal("navigator", { onLine: true });
  window.dispatchEvent(new Event("online"));
  expect(setOpen).toHaveBeenLastCalledWith(false);
  await checkNetworkReachability();
  expect(setOpen).toHaveBeenLastCalledWith(false);
  vi.stubGlobal("navigator", { onLine: false });
  window.dispatchEvent(new Event("offline"));
  expect(setOpen).toHaveBeenCalledTimes(2);
});
it("auto-opens when mounted with browser offline", () => {
  vi.stubGlobal("navigator", { onLine: false });
  expect(mount()).toHaveBeenCalledWith(true);
  expect(hasSeenOfflineModal()).toBe(true);
});
