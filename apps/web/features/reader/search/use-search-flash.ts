import { useEffect, useRef, type RefObject } from "react";
import type { SearchTarget } from "./types";
import { searchFlashRects } from "./search-flash-rects";

const HOLD_MS = 1000;
const FADE_MS = 2000;
const ARRIVAL_TIMEOUT_MS = 30000;
export function useSearchFlash(
  rootRef: RefObject<HTMLElement | null>,
  target: SearchTarget | null,
  ready: boolean,
) {
  const consumed = useRef<SearchTarget | null>(null);
  useEffect(() => {
    if (!target || !ready || consumed.current === target) return;
    const root = rootRef.current;
    if (!root) return;
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.searchSentenceFlash = "";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "40",
      mixBlendMode:
        document.documentElement.dataset.theme === "dark"
          ? "screen"
          : "multiply",
    });
    document.body.append(overlay);
    const deadline = performance.now() + ARRIVAL_TIMEOUT_MS;
    let started: number | null = null;
    let frame = 0;
    function paint(now: number) {
      const rects = searchFlashRects(root!, target!.result);
      if (rects.length && started === null) {
        started = now;
        consumed.current = target;
      }
      if (
        now > deadline ||
        (started !== null && now - started >= HOLD_MS + FADE_MS)
      ) {
        overlay.remove();
        return;
      }
      overlay.style.opacity = String(
        started === null
          ? 1
          : 1 - Math.max(0, now - started - HOLD_MS) / FADE_MS,
      );
      overlay.replaceChildren(
        ...rects.map((rect) => {
          const mark = document.createElement("span");
          Object.assign(mark.style, {
            position: "absolute",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: "var(--highlight-mimosa)",
            borderRadius: "3px",
          });
          return mark;
        }),
      );
      frame = requestAnimationFrame(paint);
    }
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      overlay.remove();
    };
  }, [rootRef, target, ready]);
}
