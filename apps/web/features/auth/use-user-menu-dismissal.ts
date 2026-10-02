"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function useUserMenuDismissal() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const close = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node)) menu.open = false;
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (!menu.open || event.key !== "Escape") return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector("summary")?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", dismissOutside, { capture: true });
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, {
        capture: true,
      });
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  return { menuRef, close };
}
