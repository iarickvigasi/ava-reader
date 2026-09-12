import { useCallback, useId, useRef, useState } from "react";

export function useAnnotationListActions({ onCopy, disabled }: {
  onCopy: () => Promise<void>;
  disabled: boolean;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuOpen = useRef(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const closeMenu = useCallback(() => {
    menuOpen.current = false;
    setIsMenuOpen(false);
  }, []);
  const toggleMenu = () => {
    menuOpen.current = !menuOpen.current;
    setIsMenuOpen(menuOpen.current);
  };
  const copyAll = async () => {
    if (disabled || isCopying) return;
    setIsCopying(true);
    try {
      // Start the clipboard write in the click gesture, without fetching first.
      await onCopy();
    } finally {
      setIsCopying(false);
      // Dismissing while the clipboard prompt is open must not steal focus back.
      if (menuOpen.current) {
        closeMenu();
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
  };
  return { menuId, triggerRef, isMenuOpen, isCopying, closeMenu, toggleMenu, copyAll };
}
