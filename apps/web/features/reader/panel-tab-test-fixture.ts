import { vi } from "vitest";
import { retainPanelTabFocus } from "./panel-tab-boundary";

export function tabFixture() {
  const doc = {
    activeElement: null as unknown,
    defaultView: { getComputedStyle: (control: { visibility: string }) => ({ visibility: control.visibility }) },
  };
  class Control {
    tabIndex = 0;
    disabled = false;
    hidden = false;
    visible = true;
    visibility = "visible";
    nested = false;
    ownerDocument = doc;
    focus = vi.fn(() => { doc.activeElement = this; });
    matches() { return this.disabled; }
    getClientRects() { return this.visible ? [1] : []; }
    closest(selector: string): unknown {
      return selector === "dialog" ? (this.nested ? {} : dialog) : (this.hidden ? {} : null);
    }
  }
  const close = new Control(), middle = new Control(), last = new Control();
  const candidates = [close, middle, last];
  const dialog = {
    open: true, isConnected: true, ownerDocument: doc,
    contains: (control: unknown) => control === dialog || candidates.includes(control as Control),
    querySelectorAll: vi.fn(() => candidates), focus: vi.fn(() => { doc.activeElement = dialog; }),
  };
  doc.activeElement = close;
  const event = (overrides = {}) => ({
    key: "Tab", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
    defaultPrevented: false, preventDefault: vi.fn(), ...overrides,
  });
  return { close, middle, last, candidates, dialog, doc, event, control: () => new Control(),
    apply: (input: ReturnType<typeof event>) => retainPanelTabFocus(dialog as unknown as HTMLDialogElement, input),
  };
}
