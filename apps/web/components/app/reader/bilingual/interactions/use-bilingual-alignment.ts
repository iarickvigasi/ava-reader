import { useEffect, useState, type RefObject } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import {
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
} from "../../selection/capture/timing";
import {
  alignmentAt,
  alignmentRects,
  type AlignmentHit,
} from "./alignment-ranges";

export function useBilingualAlignment(input: {
  rootRef: RefObject<HTMLElement | null>;
  chapter: BilingualChapter | null;
  pageKey: string;
  disabled: boolean;
}) {
  const { rootRef, chapter, pageKey, disabled } = input;
  const [paint, setPaint] = useState<{ key: string; rects: DOMRect[] } | null>(
    null,
  );
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !chapter || disabled) return;
    let active: AlignmentHit | null = null;
    let pinned = false;
    let lastTouch = 0;
    let press: {
      id: number;
      x: number;
      y: number;
      at: number;
      moved: boolean;
      touch: boolean;
    } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
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
      setPaint({
        key: pageKey,
        rects: hit ? alignmentRects(root, chapter, hit) : [],
      });
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) {
        show(null);
        press = null;
        return;
      }
      press = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        at: Date.now(),
        moved: false,
        touch: event.pointerType !== "mouse",
      };
      if (press.touch) {
        lastTouch = Date.now();
        timer = setTimeout(() => show(null), LONG_PRESS_MS);
      }
    };
    const move = (event: PointerEvent) => {
      if (press) {
        if (
          Math.abs(event.clientX - press.x) > LONG_PRESS_SLOP_PX ||
          Math.abs(event.clientY - press.y) > LONG_PRESS_SLOP_PX
        ) {
          press.moved = true;
          clearTimeout(timer);
          show(null);
        }
        return;
      }
      if (event.pointerType === "mouse" && !event.buttons && !selected())
        show(alignmentAt(root, chapter, event.clientX, event.clientY));
    };
    const up = (event: PointerEvent) => {
      clearTimeout(timer);
      const started = press;
      press = null;
      if (!started || started.id !== event.pointerId) return;
      if (started.touch) lastTouch = Date.now();
      if (
        started.moved ||
        (started.touch && Date.now() - started.at >= LONG_PRESS_MS) ||
        selected()
      )
        return;
      const hit = alignmentAt(root, chapter, event.clientX, event.clientY);
      const same =
        pinned &&
        hit?.sentenceId === active?.sentenceId &&
        hit?.groupId === active?.groupId;
      show(same ? null : hit, !same);
    };
    const click = (event: MouseEvent) => {
      // Text links and annotations never steal a bilingual alignment gesture.
      // Selection capture listens for mouseup/touchend, independently of click.
      if ((event.target as Element)?.closest?.("[data-bilingual-unit-id]")) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (Date.now() - lastTouch < 1000) return;
      // Keyboard activation also has a useful alignment result.
      if (event.detail === 0 && event.target instanceof HTMLElement) {
        const rect = event.target.getBoundingClientRect();
        show(
          alignmentAt(root, chapter, rect.left + 2, rect.top + rect.height / 2),
          true,
        );
      }
    };
    const leave = () => {
      if (!pinned && !press) show(null);
    };
    const cancel = () => {
      press = null;
      clearTimeout(timer);
      show(null);
    };
    const onSelection = () => {
      if (selected()) show(null);
    };
    const repaint = () => {
      if (active) show(active, pinned);
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", cancel);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("click", click, true);
    document.addEventListener("selectionchange", onSelection);
    window.addEventListener("resize", cancel);
    window.addEventListener("scroll", repaint, true);
    return () => {
      setPaint(null);
      clearTimeout(timer);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", cancel);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("click", click, true);
      document.removeEventListener("selectionchange", onSelection);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("scroll", repaint, true);
    };
  }, [rootRef, chapter, pageKey, disabled]);
  return !disabled && paint?.key === pageKey ? paint.rects : [];
}
