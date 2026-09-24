import { afterEach, expect, it, vi } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { useBilingualAlignment } from "./use-bilingual-alignment";

const harness = vi.hoisted(() => ({
  cursor: 0,
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  binding: { current: null as unknown },
  paint: vi.fn(),
  repaint: vi.fn(),
  dispose: vi.fn(),
  bind: vi.fn(),
}));
vi.mock("react", () => ({
  useState: () => [null, harness.paint],
  useRef: () => harness.binding,
  useEffectEvent: (callback: unknown) => callback,
  useLayoutEffect: (
    effect: () => (() => void) | undefined,
    deps: unknown[],
  ) => {
    const index = harness.cursor++;
    const previous = harness.effects[index];
    if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i])))
      return;
    previous?.cleanup?.();
    harness.effects[index] = { deps, cleanup: effect() };
  },
}));
vi.mock("./bind-bilingual-alignment", () => ({
  bindBilingualAlignment: (...args: unknown[]) => {
    harness.bind(...args);
    return { repaint: harness.repaint, dispose: harness.dispose };
  },
}));
afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  harness.effects = [];
  harness.binding.current = null;
  vi.clearAllMocks();
});
const rootRef = { current: {} as HTMLElement };
const chapter = { chapterId: "chapter", translations: {} } as BilingualChapter;
function RenderHook(
  current: BilingualChapter | null,
  pageKey = "page-1",
  disabled = false,
) {
  harness.cursor = 0;
  useBilingualAlignment({ rootRef, chapter: current, pageKey, disabled });
}

it("repaints cache arrivals without disposing the active hover or pinned gesture", () => {
  RenderHook(chapter);
  RenderHook({ ...chapter, translations: { upcoming: "New translation" } });
  RenderHook({ ...chapter, alignments: {} });
  expect(harness.bind).toHaveBeenCalledTimes(1);
  expect(harness.dispose).not.toHaveBeenCalled();
  expect(harness.repaint).toHaveBeenCalledTimes(3);
});

it("resets gestures on navigation and when a panel disables alignment", () => {
  RenderHook(chapter);
  RenderHook(chapter, "page-2");
  expect(harness.dispose).toHaveBeenCalledTimes(1);
  expect(harness.bind).toHaveBeenCalledTimes(2);
  RenderHook(chapter, "page-2", true);
  expect(harness.dispose).toHaveBeenCalledTimes(2);
  expect(harness.binding.current).toBeNull();
});

it("attaches when the chapter becomes available and detaches when removed", () => {
  RenderHook(null);
  expect(harness.bind).not.toHaveBeenCalled();
  RenderHook(chapter);
  expect(harness.bind).toHaveBeenCalledTimes(1);
  RenderHook(null);
  expect(harness.dispose).toHaveBeenCalledTimes(1);
});
