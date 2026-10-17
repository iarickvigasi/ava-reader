import { afterEach, expect, it, vi } from "vitest";
import { focusReaderPassage } from "./focus-reader-passage";
const locator = { chapterId: "c", blockId: "b", textOffset: 5 };
function element(start: number, end: number, hidden = false) {
  return {
    dataset: {
      chapterId: "c",
      blockId: "b",
      readerStartOffset: String(start),
      readerEndOffset: String(end),
    },
    closest: () => (hidden ? {} : null),
    getBoundingClientRect: () => ({ left: 10, right: 90, top: 10, bottom: 90 }),
    tabIndex: undefined as number | undefined,
    focus: vi.fn(),
  };
}
function fixture(candidates: ReturnType<typeof element>[]) {
  let frameCallback = () => {};
  const frame = { isConnected: true, querySelectorAll: () => candidates };
  vi.stubGlobal("document", { querySelector: () => frame });
  vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 720 });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frameCallback = callback;
  });
  return { frame, settle: () => frameCallback() };
}
afterEach(() => vi.unstubAllGlobals());
it("focuses the exact visible source segment and makes it programmatically focusable", () => {
  const hidden = element(5, 10, true),
    before = element(0, 5),
    target = element(5, 10);
  const f = fixture([hidden, before, target]);
  focusReaderPassage(locator);
  f.settle();
  expect(target.tabIndex).toBe(-1);
  expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(hidden.focus).not.toHaveBeenCalled();
  expect(before.focus).not.toHaveBeenCalled();
});
it("focuses a zero-length figure but never a frame removed by a book or account change", () => {
  const target = element(0, 0);
  const f = fixture([target]);
  focusReaderPassage({ ...locator, textOffset: 0 });
  f.settle();
  expect(target.focus).toHaveBeenCalledTimes(1);
  focusReaderPassage({ ...locator, textOffset: 0 });
  f.frame.isConnected = false;
  f.settle();
  expect(target.focus).toHaveBeenCalledTimes(1);
});
it("does not focus an offscreen measured source or an unavailable offset", () => {
  const target = element(0, 5);
  const f = fixture([target]);
  target.getBoundingClientRect = () => ({
    left: -100000,
    right: -99900,
    top: 10,
    bottom: 90,
  });
  focusReaderPassage(locator);
  f.settle();
  expect(target.focus).not.toHaveBeenCalled();
});

it("resolves the replacement source inside the same session after final layout swaps its frame", () => {
  const before = element(5, 10),
    after = element(5, 10);
  const candidates = [before];
  const f = fixture(candidates);
  focusReaderPassage(locator);
  candidates.splice(0, 1, after);
  f.settle();
  expect(before.focus).not.toHaveBeenCalled();
  expect(after.focus).toHaveBeenCalledWith({ preventScroll: true });
});

it("does not focus a still-connected old passage after its jump is superseded", () => {
  const target = element(5, 10);
  const f = fixture([target]);
  let current = true;
  focusReaderPassage(locator, () => current);
  current = false;
  f.settle();
  expect(target.focus).not.toHaveBeenCalled();
});
