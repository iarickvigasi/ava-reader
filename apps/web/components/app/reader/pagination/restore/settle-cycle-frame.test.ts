import { afterEach, expect, it, vi } from "vitest";
import { useSettleRestoreCycle } from "./use-settle-restore-cycle";
const hooks = vi.hoisted(() => ({
  cursor: 0,
  refs: [] as { current: unknown }[],
  effects: [] as (() => (() => void) | void)[],
  settled: vi.fn(),
}));
vi.mock("react", () => ({
  useRef: (initial: unknown) =>
    hooks.refs[hooks.cursor++] ??
    (hooks.refs[hooks.cursor - 1] = { current: initial }),
  useCallback: (callback: unknown) => callback,
  useState: () => [null, hooks.settled],
  useEffect: (effect: () => (() => void) | void) => hooks.effects.push(effect),
  useLayoutEffect: (effect: () => (() => void) | void) =>
    hooks.effects.push(effect),
}));
function fixture() {
  hooks.cursor = 0;
  hooks.refs = [];
  hooks.effects = [];
  hooks.settled.mockClear();
  const frames: (() => void)[] = [];
  const cancel = vi.fn();
  vi.stubGlobal("window", {
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    cancelAnimationFrame: cancel,
  });
  const resetRender = () => {
    hooks.cursor = 0;
    hooks.effects = [];
  };
  const useRenderCycle = (key: string) => useSettleRestoreCycle(key);
  return { frames, cancel, resetRender, useRenderCycle };
}
afterEach(() => vi.unstubAllGlobals());
it("a prior measurement frame cannot commit history after the same chapter reflows", () => {
  const f = fixture();
  f.resetRender();
  const first = f.useRenderCycle("chapter:block:width520");
  const oldSettled = vi.fn();
  first.scheduleSettle("chapter:block:width520", oldSettled);
  f.resetRender();
  const next = f.useRenderCycle("chapter:block:width1088");
  f.frames[0]();
  expect(oldSettled).not.toHaveBeenCalled();
  expect(hooks.settled).not.toHaveBeenCalled();
  const currentSettled = vi.fn();
  next.scheduleSettle("chapter:block:width1088", currentSettled);
  f.frames[1]();
  expect(currentSettled).toHaveBeenCalledOnce();
  expect(hooks.settled).toHaveBeenCalledExactlyOnceWith(
    "chapter:block:width1088",
  );
});
it("layout cleanup cancels a scheduled frame and cannot consume a cancelled jump", () => {
  const f = fixture();
  f.resetRender();
  const first = f.useRenderCycle("chapter:jump1:layout");
  const cleanup = hooks.effects[0]()!;
  first.scheduleSettle("chapter:jump1:layout", vi.fn());
  cleanup();
  expect(f.cancel).toHaveBeenCalledWith(1);
  f.resetRender();
  f.useRenderCycle("chapter:jump2:layout");
  f.frames[0]();
  expect(hooks.settled).not.toHaveBeenCalled();
});
