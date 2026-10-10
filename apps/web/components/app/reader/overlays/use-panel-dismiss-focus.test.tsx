import { useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderPanel } from "@/components/app/core/reader-ui-context";
import {
  Control,
  setupDismissUi,
  ui,
} from "./panel-dismiss-focus-test-fixture";
import { usePanelDismissFocus } from "./use-panel-dismiss-focus";
import { useCloseOnEscape } from "./use-close-on-escape";
const hooks = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | void)[],
  cleanups: [] as (() => void)[],
  dismiss: undefined as (() => void) | undefined,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => (() => void) | void) => hooks.effects.push(effect),
}));
function Probe({ panel, close }: { panel: ReaderPanel; close: () => void }) {
  const dismiss = usePanelDismissFocus(panel, close);
  useCloseOnEscape(dismiss);
  useEffect(() => {
    hooks.dismiss = dismiss;
  }, [dismiss]);
  return null;
}
function mount(panel: ReaderPanel) {
  const close = vi.fn();
  renderToStaticMarkup(<Probe panel={panel} close={close} />);
  hooks.cleanups = hooks.effects
    .map((effect) => effect())
    .filter((x): x is () => void => !!x);
  return close;
}
beforeEach(() => {
  hooks.effects = [];
  hooks.cleanups = [];
  hooks.dismiss = undefined;
  setupDismissUi();
});
afterEach(() => {
  hooks.cleanups.forEach((fn) => fn());
  vi.unstubAllGlobals();
});

it("Escape after keyboard interaction closes Preferences and returns to its trigger", () => {
  const origin = new Control("preferences");
  ui.active = origin;
  const close = mount("preferences");
  ui.active = new Control(null);
  const preventDefault = vi.fn();
  ui.listeners.get("keydown")?.({
    key: "Escape",
    preventDefault,
  } as unknown as KeyboardEvent);
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(origin.focus).toHaveBeenCalledOnce();
});
it.each(["preferences", "ai-comments", "highlights", "ai-chats"] as const)(
  "click dismissal restores the matching %s control",
  (panel) => {
    const origin = new Control(panel);
    ui.active = origin;
    const close = mount(panel);
    ui.active = new Control(null);
    hooks.dismiss?.();
    expect(close).toHaveBeenCalledOnce();
    expect(origin.focus).toHaveBeenCalledOnce();
  },
);
it.each(["hidden", "removed"])(
  "reflow uses the visible counterpart when the trigger is %s",
  (why) => {
    const origin = new Control("preferences");
    ui.active = origin;
    mount("preferences");
    origin.shown = why !== "hidden";
    origin.isConnected = why !== "removed";
    const hidden = new Control("preferences");
    hidden.shown = false;
    const shown = new Control("preferences");
    ui.controls = [hidden, shown];
    hooks.dismiss?.();
    expect(shown.focus).toHaveBeenCalledOnce();
    expect(origin.focus).not.toHaveBeenCalled();
    expect(hidden.focus).not.toHaveBeenCalled();
  },
);
it("an unfocused pointer opening uses its panel control instead of BODY", () => {
  const body = new Control(null);
  ui.active = body;
  const origin = new Control("ai-comments");
  ui.controls = [origin];
  mount("ai-comments");
  hooks.dismiss?.();
  expect(origin.focus).toHaveBeenCalledOnce();
  expect(body.focus).not.toHaveBeenCalled();
});
it("leaving the reader does not focus a control on the new route", () => {
  const origin = new Control("preferences");
  ui.active = origin;
  mount("preferences");
  ui.location.pathname = "/app";
  hooks.dismiss?.();
  expect(origin.focus).not.toHaveBeenCalled();
});
it("unmount without explicit dismissal preserves navigation target focus", () => {
  const origin = new Control("highlights");
  ui.active = origin;
  const close = mount("highlights");
  const target = new Control(null);
  ui.active = target;
  hooks.cleanups.forEach((fn) => fn());
  expect(close).not.toHaveBeenCalled();
  expect(origin.focus).not.toHaveBeenCalled();
  expect(ui.active).toBe(target);
  expect(ui.listeners.has("keydown")).toBe(false);
});
