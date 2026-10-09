import {
  useEffect,
  useId,
  useRef,
  type ToggleEvent,
  type KeyboardEvent,
} from "react";

export function useReaderOverflowMenu() {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    menuRef.current?.hidePopover();
    triggerRef.current?.focus();
  };
  useEffect(() => {
    const dismiss = () => menuRef.current?.hidePopover();
    window.addEventListener("resize", dismiss);
    return () => window.removeEventListener("resize", dismiss);
  }, []);
  const onToggle = (event: ToggleEvent<HTMLDivElement>) => {
    const open = event.newState === "open";
    triggerRef.current?.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const anchor = triggerRef.current!.getBoundingClientRect();
    event.currentTarget.style.right = `${Math.max(8, window.innerWidth - anchor.right)}px`;
    event.currentTarget.style.top = `${anchor.bottom + 6}px`;
    event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[index]?.focus();
  };
  return { id, menuRef, triggerRef, close, onToggle, onKeyDown };
}
