import { expect, it, vi } from "vitest";
import { state } from "./mastery-scroll-test-setup";
import { useMasteryScroll } from "./use-mastery-scroll";

it("starts at the most recent dates", () => {
  useMasteryScroll(7, true, vi.fn(), true);
  expect(state.element.scrollLeft).toBe(700);
});
it("preserves the visible date when another week is prepended", () => {
  state.previous = { offset: 5.5, width: 700 };
  state.element.scrollWidth = 2800;
  state.element.scrollLeft = 850;
  useMasteryScroll(21, true, vi.fn(), true);
  expect(state.element.scrollLeft).toBe(1550);
});
it("replaces the final loading slot without shifting the visible week", () => {
  state.previous = { offset: 14, width: 700 };
  state.element.scrollWidth = 2100;
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
  state.previous = { offset: 7, width: 700 };
  state.element.scrollWidth = 1050;
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

it.each([0, 3.5, 7])(
  "restores %s days from today after responsive hiding",
  (offset) => {
    const scroll = useMasteryScroll(7, true, vi.fn(), true);
    state.element.scrollLeft = 700 - offset * 100;
    scroll.onScroll();
    Object.assign(state.element, {
      clientWidth: 0,
      scrollWidth: 0,
      scrollLeft: 0,
    });
    scroll.onScroll();
    state.resize();
    Object.assign(state.element, { clientWidth: 350, scrollWidth: 700 });
    scroll.onScroll();
    state.resize();
    expect(state.element.scrollLeft).toBe(350 - offset * 50);
    expect(state.offset).toBe(offset);
  },
);
