import { useLayoutEffect, useRef, type RefObject } from "react";

const VIEWPORT_PADDING = 8;
const TRIGGER_GAP = 6;

export function useAnnotationMenu(
  triggerRef: RefObject<HTMLButtonElement | null>,
  onClose: () => void,
) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;

    const anchor = trigger.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + VIEWPORT_PADDING;
    const topEdge = (viewport?.offsetTop ?? 0) + VIEWPORT_PADDING;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - VIEWPORT_PADDING * 2;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - VIEWPORT_PADDING * 2;
    const below = anchor.bottom + TRIGGER_GAP;
    const above = anchor.top - bounds.height - TRIGGER_GAP;
    menu.style.left = `${Math.max(leftEdge, Math.min(anchor.right - bounds.width, rightEdge - bounds.width))}px`;
    menu.style.top = `${Math.max(topEdge, below + bounds.height <= bottomEdge ? below : above)}px`;
    menu.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus({ preventScroll: true });

    const isOutside = (target: EventTarget | null) =>
      target instanceof Node && !menu.contains(target) && !trigger.contains(target);
    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      if (isOutside(event.target)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
      onClose();
      // For Tab, let the browser continue from the trigger in document order.
      trigger.focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    viewport?.addEventListener("scroll", onClose);
    viewport?.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      viewport?.removeEventListener("scroll", onClose);
      viewport?.removeEventListener("resize", onClose);
    };
  }, [onClose, triggerRef]);

  return menuRef;
}
