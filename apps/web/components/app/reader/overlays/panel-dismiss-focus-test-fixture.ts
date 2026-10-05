import { vi } from "vitest";
import type { ReaderPanel } from "@/components/app/core/reader-ui-context";

export class Control {
  isConnected = true;
  shown = true;
  focus = vi.fn();
  constructor(readonly panel: ReaderPanel | null) {}
  getClientRects() {
    return this.shown ? [{}] : [];
  }
  matches(selector: string) {
    return (
      this.panel !== null &&
      selector === `[data-reader-panel-control="${this.panel}"]`
    );
  }
}
export const ui = {
  active: null as Control | null,
  controls: [] as Control[],
  location: { pathname: "/app/read/book" },
  listeners: new Map<string, (event: KeyboardEvent) => void>(),
};
export function setupDismissUi() {
  ui.active = null;
  ui.controls = [];
  ui.listeners.clear();
  ui.location.pathname = "/app/read/book";
  vi.stubGlobal("HTMLElement", Control);
  vi.stubGlobal("document", {
    get activeElement() {
      return ui.active;
    },
    querySelectorAll: (selector: string) =>
      ui.controls.filter((c) => c.matches(selector)),
  });
  vi.stubGlobal("window", {
    location: ui.location,
    addEventListener: (key: string, fn: (event: KeyboardEvent) => void) =>
      ui.listeners.set(key, fn),
    removeEventListener: (key: string) => ui.listeners.delete(key),
  });
}
