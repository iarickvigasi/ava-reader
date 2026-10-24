import { afterEach, expect, it, vi } from "vitest";
import { readFeedAnchor, restoreFeedPosition } from "./feed-position";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("ignores hidden Next route copies and keeps the visible title anchored as covers resize", async () => {
  vi.useFakeTimers();
  let y = 1200;
  let resized = () => undefined;
  const handlers = new Map<string, () => void>();
  const window = {
    scrollY: 1000,
    innerHeight: 800,
    scrollTo: vi.fn((_x: number, value: number) => {
      window.scrollY = value;
    }),
    addEventListener: (key: string, callback: () => void) =>
      handlers.set(key, callback),
    removeEventListener: (key: string) => handlers.delete(key),
  };
  const visible = {
    closest: (selector: string) =>
      selector === "a" ? { pathname: "/app/explore/books/book" } : {},
    getBoundingClientRect: () => ({
      top: y - window.scrollY,
      bottom: y - window.scrollY + 50,
      height: 50,
    }),
  };
  const hidden = {
    ...visible,
    getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0 }),
  };
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", { querySelectorAll: () => [hidden, visible] });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
    setTimeout(callback, 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => undefined) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  expect(readFeedAnchor()).toEqual({
    path: "/app/explore/books/book",
    top: 200,
  });
  window.scrollY = 0;
  const stop = restoreFeedPosition(1000, {
    path: "/app/explore/books/book",
    top: 200,
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(window.scrollY).toBe(1000);
  y += 84;
  resized();
  await vi.advanceTimersByTimeAsync(1);
  expect(window.scrollY).toBe(1084);
  handlers.get("wheel")!();
  const calls = window.scrollTo.mock.calls.length;
  y += 40;
  await vi.advanceTimersByTimeAsync(3000);
  expect(window.scrollTo).toHaveBeenCalledTimes(calls);
  stop();
});
