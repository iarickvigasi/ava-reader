import type { SelectionPointer } from "../types";
import { isInsideReader } from "./is-inside-reader";

const EXTEND_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

type Endpoints = {
  anchorNode: Node | null;
  anchorOffset: number;
  focusNode: Node | null;
  focusOffset: number;
};
const endpoints = (selection: Selection): Endpoints => ({
  anchorNode: selection.anchorNode,
  anchorOffset: selection.anchorOffset,
  focusNode: selection.focusNode,
  focusOffset: selection.focusOffset,
});
const changed = (a: Endpoints, b: Endpoints) =>
  a.anchorNode !== b.anchorNode ||
  a.anchorOffset !== b.anchorOffset ||
  a.focusNode !== b.focusNode ||
  a.focusOffset !== b.focusOffset;
const editable = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "button, input, select, textarea, [contenteditable]:not([contenteditable='false'])",
    ),
  );

// Let the browser extend its caret selection while Shift is held. Opening a modal
// on each Arrow key would interrupt that gesture. Capture only its final, changed
// range after Shift release; this helper never creates or modifies a DOM Range.
export function createKeyboardSelectionCapture({
  win,
  doc,
  getContainer,
  suppressed,
  schedule,
  capture,
}: {
  win: Window;
  doc: Document;
  getContainer: () => HTMLElement | null;
  suppressed: () => boolean;
  schedule: (run: () => void) => void;
  capture: (pointer: SelectionPointer) => void;
}) {
  let gesture: { container: HTMLElement; before: Endpoints } | null = null;
  let epoch = 0;
  const inside = (selection: Selection, container: HTMLElement) =>
    isInsideReader(selection.anchorNode, container) &&
    isInsideReader(selection.focusNode, container);
  const eligibleTarget = (target: EventTarget | null, container: HTMLElement) =>
    !editable(target) &&
    (isInsideReader(target, container) || target === doc.body);
  const cancel = () => {
    gesture = null;
    epoch += 1;
  };
  const keydown = (event: KeyboardEvent) => {
    const container = getContainer(),
      selection = win.getSelection();
    if (
      !container ||
      suppressed() ||
      !eligibleTarget(event.target, container)
    ) {
      cancel();
      return;
    }
    if (
      !event.shiftKey ||
      !EXTEND_KEYS.has(event.key) ||
      event.defaultPrevented
    ) {
      if (event.key !== "Shift") cancel();
      return;
    }
    if (!selection || !selection.rangeCount || !inside(selection, container)) {
      cancel();
      return;
    }
    if (!gesture) {
      epoch += 1;
      gesture = { container, before: endpoints(selection) };
    }
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.key !== "Shift") return;
    const held = gesture;
    cancel();
    if (
      !held ||
      suppressed() ||
      getContainer() !== held.container ||
      !eligibleTarget(event.target, held.container)
    )
      return;
    const releaseEpoch = epoch;
    schedule(() => {
      const selection = win.getSelection();
      if (
        epoch !== releaseEpoch ||
        suppressed() ||
        getContainer() !== held.container ||
        !selection ||
        !inside(selection, held.container) ||
        !changed(held.before, endpoints(selection))
      )
        return;
      capture("keyboard");
    });
  };
  const focusin = (event: FocusEvent) => {
    const container = getContainer();
    if (
      !container ||
      !isInsideReader(event.target, container) ||
      editable(event.target)
    )
      cancel();
  };
  doc.addEventListener("focusin", focusin);
  win.addEventListener("blur", cancel);
  doc.addEventListener("keydown", keydown);
  doc.addEventListener("keyup", keyup);
  doc.addEventListener("pointerdown", cancel);
  doc.addEventListener("visibilitychange", cancel);
  return {
    cancel,
    destroy() {
      cancel();
      doc.removeEventListener("focusin", focusin);
      win.removeEventListener("blur", cancel);
      doc.removeEventListener("keydown", keydown);
      doc.removeEventListener("keyup", keyup);
      doc.removeEventListener("pointerdown", cancel);
      doc.removeEventListener("visibilitychange", cancel);
    },
  };
}
