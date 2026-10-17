import { afterEach, it, expect, vi } from "vitest";
import { bindBilingualAlignment } from "./bind-bilingual-alignment";
afterEach(() => vi.unstubAllGlobals());
it("does not swallow source note links, buttons or saved annotation marks", () => {
  const handlers = new Map<string, (event: MouseEvent) => void>();
  const root = {
    addEventListener: (key: string, handler: (event: MouseEvent) => void) =>
      handlers.set(key, handler),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const binding = bindBilingualAlignment(root, () => null, vi.fn());
  const preventDefault = vi.fn(),
    stopPropagation = vi.fn();
  const event = {
    target: {
      closest: (selector: string) =>
        selector.includes("a, button") ? {} : null,
    },
    detail: 1,
    preventDefault,
    stopPropagation,
  } as unknown as MouseEvent;
  handlers.get("click")!(event);
  expect(preventDefault).not.toHaveBeenCalled();
  expect(stopPropagation).not.toHaveBeenCalled();
  binding.dispose();
});
