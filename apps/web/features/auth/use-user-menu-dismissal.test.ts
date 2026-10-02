import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  pathname: "/app",
  effects: [] as Array<() => void | (() => void)>,
  menu: { open: false, contains: vi.fn(), querySelector: vi.fn() },
}));
vi.mock("react", () => ({
  useRef: () => ({ current: harness.menu }),
  useEffect: (effect: () => void | (() => void)) =>
    harness.effects.push(effect),
}));
vi.mock("next/navigation", () => ({ usePathname: () => harness.pathname }));
import { useUserMenuDismissal as renderMenu } from "./use-user-menu-dismissal";

let doc: EventTarget;
let cleanup: (() => void) | void;
const focus = vi.fn();
beforeEach(() => {
  doc = new EventTarget();
  vi.stubGlobal("document", doc);
  harness.effects = [];
  harness.menu.open = false;
  harness.menu.contains.mockReturnValue(false);
  harness.menu.querySelector.mockReturnValue({ focus });
  focus.mockClear();
  renderMenu();
  harness.effects[0]();
  cleanup = harness.effects[1]();
  harness.menu.open = true;
});
afterEach(() => {
  cleanup?.();
  vi.unstubAllGlobals();
});

it.each(["mouse", "touch"])(
  "dismisses outside %s input without cancelling it",
  (pointerType) => {
    const event = new Event("pointerdown", { cancelable: true });
    Object.assign(event, { pointerType });
    doc.dispatchEvent(event);
    expect(harness.menu.open).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  },
);
it("preserves inside interactions, including the native summary toggle", () => {
  harness.menu.contains.mockReturnValue(true);
  doc.dispatchEvent(new Event("pointerdown"));
  expect(harness.menu.open).toBe(true);
});
it("closes on Escape and focuses the summary only while open", () => {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { key: "Escape" });
  doc.dispatchEvent(event);
  expect(harness.menu.open).toBe(false);
  expect(event.defaultPrevented).toBe(true);
  expect(focus).toHaveBeenCalledOnce();
  doc.dispatchEvent(event);
  expect(focus).toHaveBeenCalledOnce();
});
it("keeps the menu open for other keys", () => {
  const event = new Event("keydown");
  Object.assign(event, { key: "Enter" });
  doc.dispatchEvent(event);
  expect(harness.menu.open).toBe(true);
});
it("closes after navigation and browser history pathname changes", () => {
  for (const pathname of ["/app/library", "/app", "/app/library"]) {
    harness.menu.open = true;
    harness.pathname = pathname;
    harness.effects = [];
    renderMenu();
    harness.effects[0]();
    expect(harness.menu.open).toBe(false);
  }
});
it("allows an account action to close the menu", () => {
  renderMenu().close();
  expect(harness.menu.open).toBe(false);
});
it("removes document listeners on unmount", () => {
  cleanup?.();
  doc.dispatchEvent(new Event("pointerdown"));
  expect(harness.menu.open).toBe(true);
});
