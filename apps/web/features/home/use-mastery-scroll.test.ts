import { beforeEach, expect, it, vi } from "vitest";
import { useMasteryScroll } from "./use-mastery-scroll";

const state = vi.hoisted(() => ({
  element: {
    clientWidth: 700,
    scrollWidth: 1400,
    scrollLeft: 0,
    scrollTo: vi.fn(),
  },
  previous: { count: 0, more: false, width: 0 },
  calls: 0,
  offset: 0,
}));
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useRef: () => ({
    current: state.calls++ % 2 === 0 ? state.element : state.previous,
  }),
  useState: () => [
    state.offset,
    (value: number) => {
      state.offset = value;
    },
  ],
  useLayoutEffect: (effect: () => void) => {
    effect();
  },
}));
beforeEach(() => {
  state.calls = 0;
  state.offset = 0;
  state.previous = { count: 0, more: false, width: 0 };
  Object.assign(state.element, {
    clientWidth: 700,
    scrollWidth: 1400,
    scrollLeft: 0,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
it("starts at the most recent dates", () => {
  useMasteryScroll(7, true, vi.fn(), true);
  expect(state.element.scrollLeft).toBe(1400);
});
it("preserves the visible date when another week is prepended", () => {
  state.previous = { count: 14, more: true, width: 700 };
  state.element.scrollLeft = 850;
  useMasteryScroll(21, true, vi.fn(), true);
  expect(state.element.scrollLeft).toBe(1550);
});
it("replaces the final loading slot without shifting the visible week", () => {
  state.previous = { count: 14, more: true, width: 700 };
  state.element.scrollLeft = 0;
  useMasteryScroll(21, false, vi.fn(), true);
  expect(state.element.scrollLeft).toBe(0);
});
it("loads at the older edge but does not retry automatically after errors", () => {
  const load = vi.fn();
  const scroll = useMasteryScroll(7, true, load, true);
  state.element.scrollLeft = 200;
  scroll.onScroll();
  expect(load).toHaveBeenCalledOnce();
  const failed = useMasteryScroll(7, true, load, false);
  state.element.scrollLeft = 0;
  failed.onScroll();
  expect(load).toHaveBeenCalledOnce();
});
it("keeps the same date position when the viewport resizes", () => {
  state.previous = { count: 14, more: true, width: 700 };
  state.element.scrollLeft = 700;
  state.element.clientWidth = 350;
  useMasteryScroll(14, true, vi.fn(), true);
  expect(state.element.scrollLeft).toBe(350);
});

it("preserves partial-day scrolling until today has fully left the viewport", () => {
  const scroll = useMasteryScroll(7, true, vi.fn(), true);
  state.element.scrollLeft = 625;
  scroll.onScroll();
  expect(state.offset).toBe(0.75);
  state.element.scrollLeft = 600;
  scroll.onScroll();
  expect(state.offset).toBe(1);
});
it.each([-1, 1])("aligns a week move in direction %s", (direction) => {
  state.element.scrollWidth = 2800;
  const scroll = useMasteryScroll(21, true, vi.fn(), true);
  state.element.scrollLeft = 1325;
  scroll.move(direction);
  expect(state.element.scrollTo).toHaveBeenLastCalledWith({
    left: 1400 + direction * 700,
    behavior: "instant",
  });
});
