import { afterEach, expect, it, vi } from "vitest";
import { useKeyboardPageNavigation } from "./use-keyboard-page-navigation";
let cleanup: (() => void) | void;
vi.mock("react", () => ({ useEffect: (effect: () => (() => void)) => { cleanup = effect(); } }));
class Target {
  constructor(private insideTable: boolean) {}
  closest(selector: string) {
    return this.insideTable && selector.includes("[data-reader-table-scroll]") ? this : null;
  }
}
afterEach(() => { cleanup?.(); vi.unstubAllGlobals(); });
it("leaves focused table arrows to native scrolling and resumes page keys after focus leaves", () => {
  let keydown: (event: KeyboardEvent) => void = () => {};
  vi.stubGlobal("HTMLElement", Target);
  vi.stubGlobal("window", {
    addEventListener: (_type: string, handler: typeof keydown) => { keydown = handler; },
    removeEventListener: vi.fn(),
  });
  const next = vi.fn(), previous = vi.fn();
  useKeyboardPageNavigation({ goToNextPage: next, goToPreviousPage: previous, isPanelOpen: false });
  const key = (inside: boolean, key: string) => ({
    target: new Target(inside), key, preventDefault: vi.fn(),
    defaultPrevented: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
  });
  for (const arrow of ["ArrowLeft", "ArrowRight"]) {
    const event = key(true, arrow);
    keydown(event as unknown as KeyboardEvent);
    expect(event.preventDefault).not.toHaveBeenCalled();
  }
  expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
  const event = key(false, "ArrowRight");
  keydown(event as unknown as KeyboardEvent);
  expect(next).toHaveBeenCalledOnce();
  expect(event.preventDefault).toHaveBeenCalledOnce();
});
