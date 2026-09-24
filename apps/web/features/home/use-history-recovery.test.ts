import { afterEach, expect, it, vi } from "vitest";
const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock("react", () => ({
  useEffect: (effect: () => void) => effects.push(effect),
  useEffectEvent: (callback: () => void) => callback,
}));
import { useHistoryRecovery } from "./use-history-recovery";
afterEach(() => {
  effects.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("retries the outstanding week when auth becomes ready and on reconnect", () => {
  vi.useFakeTimers();
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  const network = { onLine: false };
  vi.stubGlobal("navigator", network);
  const load = vi.fn(async () => {});
  useHistoryRecovery("error", true, load);
  const cleanup = effects.map((effect) => effect());
  expect(load).not.toHaveBeenCalled();
  network.onLine = true;
  target.dispatchEvent(new Event("online"));
  expect(load).toHaveBeenCalledOnce();
  cleanup.forEach((stop) => stop?.());
  target.dispatchEvent(new Event("online"));
  expect(load).toHaveBeenCalledOnce();
});
it("does not fetch history that was never requested", () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  const load = vi.fn(async () => {});
  useHistoryRecovery("idle", true, load);
  const cleanup = effects.map((effect) => effect());
  expect(load).not.toHaveBeenCalled();
  cleanup.forEach((stop) => stop?.());
});
