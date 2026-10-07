import { afterEach, expect, it, vi } from "vitest";
import { openReaderPanelDialog } from "./panel-dialog-lifecycle";

class Control {
  isConnected = true;
  focus = vi.fn();
  getClientRects() { return [1]; }
}

function fixture() {
  const trigger = new Control();
  const fallback = new Control();
  const initial = new Control();
  const range = { sourceText: "quiet blue light", startOffset: 11, endOffset: 27 };
  vi.stubGlobal("HTMLElement", Control);
  vi.stubGlobal("document", { activeElement: trigger, querySelectorAll: () => [fallback] });
  vi.stubGlobal("window", { location: { pathname: "/app/read/book" }, getSelection: () => range });
  const dialog = { open: false, querySelector: vi.fn(() => initial), showModal: vi.fn(() => { dialog.open = true; }), close: vi.fn(() => { dialog.open = false; }) };
  initial.focus.mockImplementation(() => expect(dialog.open).toBe(true));
  const closePanel = vi.fn();
  const controls = openReaderPanelDialog(dialog as unknown as HTMLDialogElement, "[data-reader-panel-control]", closePanel);
  return { trigger, fallback, initial, range, dialog, closePanel, controls };
}
afterEach(() => vi.unstubAllGlobals());

it("uses native modality once and never clears or rewrites the captured selection", () => {
  const f = fixture();
  expect(f.dialog.showModal).toHaveBeenCalledOnce();
  expect(f.dialog.querySelector).toHaveBeenCalledWith("[data-reader-initial-focus]");
  expect(f.initial.focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(window.getSelection()).toBe(f.range);
  expect(f.range).toEqual({ sourceText: "quiet blue light", startOffset: 11, endOffset: 27 });
  f.controls.dispose();
  f.controls.dispose();
  expect(f.dialog.close).toHaveBeenCalledOnce();
  expect(f.closePanel).not.toHaveBeenCalled();
  expect(f.trigger.focus).not.toHaveBeenCalled();
});
it("dismissal releases native inertness before restoring the exact trigger once", () => {
  const f = fixture();
  f.trigger.focus.mockImplementation(() => expect(f.dialog.open).toBe(false));
  f.controls.dismiss();
  f.controls.dismiss();
  expect(f.dialog.close).toHaveBeenCalledOnce();
  expect(f.closePanel).toHaveBeenCalledOnce();
  expect(f.trigger.focus).toHaveBeenCalledOnce();
});
it("a successful passage choice delegates target focus without inverse trigger restoration", () => {
  const f = fixture();
  const target = vi.fn(() => expect(f.dialog.open).toBe(false));
  f.controls.navigate(target);
  f.controls.dispose();
  expect(target).toHaveBeenCalledOnce();
  expect(f.closePanel).toHaveBeenCalledOnce();
  expect(f.trigger.focus).not.toHaveBeenCalled();
});
it("passage focus wins after the browser synchronously restores the opener on native close", () => {
  const f = fixture();
  const order: string[] = [];
  f.trigger.focus.mockImplementation(() => order.push("native opener"));
  f.dialog.close.mockImplementation(() => {
    f.dialog.open = false;
    f.trigger.focus();
  });
  f.controls.navigate(() => order.push("exact passage"));
  f.controls.dispose();
  expect(order).toEqual(["native opener", "exact passage"]);
  expect(f.dialog.close).toHaveBeenCalledOnce();
  expect(f.closePanel).toHaveBeenCalledOnce();
});
it("scope exit never restores an old route or disconnected control", () => {
  const f = fixture();
  window.location.pathname = "/app/read/another-book";
  f.controls.dismiss();
  expect(f.trigger.focus).not.toHaveBeenCalled();
  expect(f.fallback.focus).not.toHaveBeenCalled();
});
it("responsive dismissal finds the visible replacement when the original control disappeared", () => {
  const f = fixture();
  f.trigger.isConnected = false;
  f.controls.dismiss();
  expect(f.trigger.focus).not.toHaveBeenCalled();
  expect(f.fallback.focus).toHaveBeenCalledOnce();
});
