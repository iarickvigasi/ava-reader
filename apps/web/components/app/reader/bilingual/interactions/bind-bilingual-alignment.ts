import type { AlignmentHit } from "./alignment-ranges";
import { alignmentPointerHandlers } from "./alignment-pointer-handlers";

export function bindBilingualAlignment(
  root: HTMLElement,
  hitAt: (x: number, y: number) => AlignmentHit | null,
  paint: (hit: AlignmentHit | null) => void,
) {
  let active: AlignmentHit | null = null;
  let pinned = false;
  const selected = () => {
    const selection = window.getSelection();
    return (
      !!selection &&
      !selection.isCollapsed &&
      !!selection.anchorNode &&
      root.contains(selection.anchorNode)
    );
  };
  const show = (hit: AlignmentHit | null, pin = false) => {
    active = hit;
    pinned = pin;
    paint(hit);
  };
  const pointer = alignmentPointerHandlers({
    hitAt,
    show,
    selected,
    toggle: (hit) => {
      const same =
        pinned &&
        hit?.sentenceId === active?.sentenceId &&
        hit?.groupId === active?.groupId;
      show(same ? null : hit, !same);
    },
  });
  const click = (event: MouseEvent) => {
    // Text links and annotations never steal a bilingual alignment gesture.
    // Selection capture listens for mouseup/touchend, independently of click.
    if ((event.target as Element)?.closest?.("[data-bilingual-unit-id]")) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (pointer.isRecentTouch()) return;
    // Keyboard activation also has a useful alignment result.
    if (event.detail === 0 && event.target instanceof HTMLElement) {
      const rect = event.target.getBoundingClientRect();
      show(hitAt(rect.left + 2, rect.top + rect.height / 2), true);
    }
  };
  const leave = () => {
    if (!pinned && !pointer.isPressed()) show(null);
  };
  const cancel = () => {
    pointer.cancel();
    show(null);
  };
  const onSelection = () => {
    if (selected()) show(null);
  };
  const repaint = () => {
    if (active) show(active, pinned);
  };
  root.addEventListener("pointerdown", pointer.down);
  root.addEventListener("pointermove", pointer.move);
  root.addEventListener("pointerup", pointer.up);
  root.addEventListener("pointercancel", cancel);
  root.addEventListener("pointerleave", leave);
  root.addEventListener("click", click, true);
  document.addEventListener("selectionchange", onSelection);
  window.addEventListener("resize", cancel);
  window.addEventListener("scroll", repaint, true);
  return {
    repaint,
    dispose: () => {
      pointer.cancel();
      paint(null);
      root.removeEventListener("pointerdown", pointer.down);
      root.removeEventListener("pointermove", pointer.move);
      root.removeEventListener("pointerup", pointer.up);
      root.removeEventListener("pointercancel", cancel);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("click", click, true);
      document.removeEventListener("selectionchange", onSelection);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("scroll", repaint, true);
    },
  };
}
