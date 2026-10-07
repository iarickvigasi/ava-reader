import { beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  element: {
    clientWidth: 700,
    scrollWidth: 1400,
    scrollLeft: 0,
    scrollTo: vi.fn(),
  },
  previous: { offset: 0, width: 0 },
  resize: () => {},
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
  state.previous = { offset: 0, width: 0 };
  Object.assign(state.element, {
    clientWidth: 700,
    scrollWidth: 1400,
    scrollLeft: 0,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        state.resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

export { state };
