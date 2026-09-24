import {
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
} from "../../selection/capture/timing";
import type { AlignmentHit } from "./alignment-ranges";

export function alignmentPointerHandlers({
  hitAt,
  show,
  toggle,
  selected,
}: {
  hitAt: (x: number, y: number) => AlignmentHit | null;
  show: (hit: AlignmentHit | null) => void;
  toggle: (hit: AlignmentHit | null) => void;
  selected: () => boolean;
}) {
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
      show(hitAt(event.clientX, event.clientY));
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
    const hit = hitAt(event.clientX, event.clientY);
    toggle(hit);
  };
  return {
    down,
    move,
    up,
    isPressed: () => !!press,
    isRecentTouch: () => Date.now() - lastTouch < 1000,
    cancel: () => {
      press = null;
      clearTimeout(timer);
    },
  };
}
