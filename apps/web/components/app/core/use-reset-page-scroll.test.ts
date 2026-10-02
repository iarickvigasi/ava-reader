import { afterEach, expect, it, vi } from "vitest";
import { useResetPageScroll } from "./use-reset-page-scroll";

const effects = vi.hoisted(
  () => [] as { run: () => void | (() => void); deps: unknown[] }[],
);
vi.mock("react", () => ({
  useLayoutEffect: (run: () => void, deps: unknown[]) => {
    effects.push({ run, deps });
  },
}));

afterEach(() => {
  effects.length = 0;
  vi.unstubAllGlobals();
});

it("resets document scroll immediately and keys the reset only to the page", () => {
  const scrollTo = vi.fn();
  vi.stubGlobal("window", { scrollTo });
  useResetPageScroll("/app/library");
  expect(effects[1].deps).toEqual(["/app/library"]);
  effects[1].run();
  expect(scrollTo).toHaveBeenCalledWith({
    top: 0,
    left: 0,
    behavior: "instant",
  });
  useResetPageScroll("/app/library/books/example");
  expect(effects[3].deps).toEqual(["/app/library/books/example"]);
});

it("prevents history restoration, resets cached documents, and cleans up", () => {
  const browser = {
    history: { scrollRestoration: "auto" },
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("window", browser);
  useResetPageScroll("/app/library");
  const cleanup = effects[0].run();
  expect(browser.history.scrollRestoration).toBe("manual");
  const [event, onPageShow] = browser.addEventListener.mock.calls[0];
  expect(event).toBe("pageshow");
  onPageShow();
  expect(browser.scrollTo).toHaveBeenCalledOnce();
  cleanup?.();
  expect(browser.history.scrollRestoration).toBe("auto");
  expect(browser.removeEventListener).toHaveBeenCalledWith(
    "pageshow",
    onPageShow,
  );
});
