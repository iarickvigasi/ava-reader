import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TouchEvent } from "react";
import { useSwipePageNavigation } from "./use-swipe-page-navigation";

const runtime = vi.hoisted(() => ({
  ref: undefined as { current: unknown } | undefined,
}));
vi.mock("react", () => ({
  useRef: (value: unknown) => runtime.ref ?? (runtime.ref = { current: value }),
}));

// Native DOM subset: closest traverses ancestry, including SVG Elements that
// are not HTMLElements. Only React's ref lifetime is mocked, not swipe logic.
class SurfaceElement {
  constructor(
    readonly parentElement: SurfaceElement | null = null,
    readonly tableScroll = false,
  ) {}
  closest(selector: string): SurfaceElement | null {
    if (selector !== "[data-reader-table-scroll]")
      throw new Error("Unexpected selector");
    if (this.tableScroll) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  contains(node: unknown) {
    return node === this;
  }
}
class HtmlElement extends SurfaceElement {}
class SvgElement extends SurfaceElement {}
const viewport = new HtmlElement(null, true);
const span = new HtmlElement(new HtmlElement(viewport));
const svg = new SvgElement(new HtmlElement(viewport));
const outside = new HtmlElement();

beforeEach(() => {
  runtime.ref = undefined;
  vi.stubGlobal("Element", SurfaceElement);
  vi.stubGlobal("HTMLElement", HtmlElement);
  vi.stubGlobal("window", { getSelection: () => null });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function gesture(
  target: EventTarget | SurfaceElement,
  x: number,
  y = 0,
  present = true,
) {
  const event = {
    target,
    touches: present ? [{ clientX: x, clientY: y }] : [],
    changedTouches: present ? [{ clientX: x, clientY: y }] : [],
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  return { event, touch: event as unknown as TouchEvent<HTMLDivElement> };
}
function fixture() {
  const next = vi.fn(),
    previous = vi.fn();
  const props = {
    goToNextPage: next,
    goToPreviousPage: previous,
    isLoadingChapter: false,
    isPanelOpen: false,
    containerRef: { current: outside as unknown as HTMLElement | null },
  };
  const useHandlers = () => useSwipePageNavigation(props);
  return { next, previous, props, render: useHandlers };
}
function noInterception(event: ReturnType<typeof gesture>["event"]) {
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.stopPropagation).not.toHaveBeenCalled();
}

it.each([viewport, span, svg])(
  "leaves a table-origin pan to native scrolling even when it releases outside",
  (target) => {
    const f = fixture(),
      handlers = f.render();
    const start = gesture(target, 100),
      end = gesture(outside, 300);
    handlers.handleTouchStart(start.touch);
    handlers.handleTouchEnd(end.touch);
    expect(f.next).not.toHaveBeenCalled();
    expect(f.previous).not.toHaveBeenCalled();
    noInterception(start.event);
    noInterception(end.event);
    expect(svg instanceof HtmlElement).toBe(false);
  },
);

it("clears an earlier armed page swipe when the next touch starts in a table", () => {
  const f = fixture(),
    handlers = f.render();
  handlers.handleTouchStart(gesture(outside, 300).touch);
  handlers.handleTouchStart(gesture(span, 300).touch);
  handlers.handleTouchEnd(gesture(outside, 100).touch);
  expect(f.next).not.toHaveBeenCalled();
  expect(f.previous).not.toHaveBeenCalled();
  handlers.handleTouchStart(gesture(outside, 300).touch);
  handlers.handleTouchEnd(gesture(outside, 100).touch);
  expect(f.next).toHaveBeenCalledOnce();
});

it.each(["container", "controls", "loading", "panel"])(
  "does not rearm a table-origin gesture across a %s scope change",
  (scope) => {
    const f = fixture();
    f.render().handleTouchStart(gesture(span, 100).touch);
    if (scope === "container")
      f.props.containerRef = {
        current: new HtmlElement() as unknown as HTMLElement,
      };
    if (scope === "controls") {
      f.props.goToNextPage = vi.fn();
      f.props.goToPreviousPage = vi.fn();
    }
    if (scope === "loading") f.props.isLoadingChapter = true;
    if (scope === "panel") f.props.isPanelOpen = true;
    f.render();
    f.props.isLoadingChapter = false;
    f.props.isPanelOpen = false;
    f.render().handleTouchEnd(gesture(outside, 300).touch);
    for (const callback of [
      f.next,
      f.previous,
      f.props.goToNextPage,
      f.props.goToPreviousPage,
    ])
      expect(callback).not.toHaveBeenCalled();
  },
);

it.each([
  [100, "next"],
  [300, "previous"],
] as const)("retains genuine outside-table swipe to %s", (endX, direction) => {
  const f = fixture(),
    handlers = f.render();
  const start = gesture(outside, 200),
    end = gesture(viewport, endX);
  handlers.handleTouchStart(start.touch);
  handlers.handleTouchEnd(end.touch);
  expect(direction === "next" ? f.next : f.previous).toHaveBeenCalledOnce();
  expect(direction === "next" ? f.previous : f.next).not.toHaveBeenCalled();
  noInterception(start.event);
  noInterception(end.event);
});

it("keeps synchronous reader selection ahead of page swiping", () => {
  const f = fixture(),
    handlers = f.render();
  handlers.handleTouchStart(gesture(outside, 300).touch);
  vi.stubGlobal("window", {
    getSelection: () => ({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => "selected",
      getRangeAt: () => ({ commonAncestorContainer: outside }),
    }),
  });
  handlers.handleTouchEnd(gesture(outside, 100).touch);
  expect(f.next).not.toHaveBeenCalled();
  expect(f.previous).not.toHaveBeenCalled();
});

it.each(["loading", "panel", "missing-start", "missing-end"])(
  "keeps an incomplete or blocked %s gesture disarmed",
  (gate) => {
    const f = fixture();
    f.render().handleTouchStart(gesture(outside, 300).touch);
    f.props.isLoadingChapter = gate === "loading";
    f.props.isPanelOpen = gate === "panel";
    const handlers = f.render();
    handlers.handleTouchStart(
      gesture(outside, 300, 0, gate !== "missing-start").touch,
    );
    handlers.handleTouchEnd(
      gesture(outside, 100, 0, gate !== "missing-end").touch,
    );
    f.props.isLoadingChapter = false;
    f.props.isPanelOpen = false;
    f.render().handleTouchEnd(gesture(outside, 100).touch);
    expect(f.next).not.toHaveBeenCalled();
    expect(f.previous).not.toHaveBeenCalled();
  },
);

it.each(["isLoadingChapter", "isPanelOpen"] as const)(
  "clears a page gesture when %s becomes true at release",
  (gate) => {
    const f = fixture();
    f.render().handleTouchStart(gesture(outside, 300).touch);
    f.props[gate] = true;
    f.render().handleTouchEnd(gesture(outside, 100).touch);
    f.props[gate] = false;
    f.render().handleTouchEnd(gesture(outside, 100).touch);
    expect(f.next).not.toHaveBeenCalled();
    expect(f.previous).not.toHaveBeenCalled();
  },
);
