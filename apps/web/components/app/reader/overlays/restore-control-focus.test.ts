import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { restoreControlFocus } from "./restore-control-focus";

class Control {
  isConnected = true;
  shown = true;
  focus = vi.fn();
  getClientRects() {
    return this.shown ? [{}] : [];
  }
}
let controls: Control[];
const location = { pathname: "/app/read/book" };
const selector = '[data-reader-panel-control="search"]';
const element = (control: Control) => control as unknown as HTMLElement;
beforeEach(() => {
  controls = [];
  location.pathname = "/app/read/book";
  vi.stubGlobal("HTMLElement", Control);
  vi.stubGlobal("window", { location });
  vi.stubGlobal("document", {
    querySelectorAll: (query: string) => query === selector ? controls : [],
  });
});
afterEach(() => vi.unstubAllGlobals());

it("returns to the original visible control", () => {
  const origin = new Control();
  const other = new Control();
  controls = [other];
  restoreControlFocus(element(origin), location.pathname, selector);
  expect(origin.focus).toHaveBeenCalledOnce();
  expect(other.focus).not.toHaveBeenCalled();
});

it.each(["hidden", "removed"])("returns to the visible counterpart when the origin is %s", (reason) => {
  const origin = new Control();
  origin.shown = reason !== "hidden";
  origin.isConnected = reason !== "removed";
  const hidden = new Control();
  hidden.shown = false;
  const counterpart = new Control();
  controls = [hidden, counterpart];
  restoreControlFocus(element(origin), location.pathname, selector);
  expect(counterpart.focus).toHaveBeenCalledOnce();
  expect(origin.focus).not.toHaveBeenCalled();
  expect(hidden.focus).not.toHaveBeenCalled();
});

it("does not steal focus after leaving the book", () => {
  const origin = new Control();
  location.pathname = "/app";
  restoreControlFocus(element(origin), "/app/read/book", selector);
  expect(origin.focus).not.toHaveBeenCalled();
});

it("safely leaves focus alone when no relevant control remains", () => {
  expect(() => restoreControlFocus(null, location.pathname, selector)).not.toThrow();
});
