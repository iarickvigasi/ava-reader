import type { RefObject } from "react";
import { useEffect } from "react";

// Closes an open row menu when the user presses down anywhere outside `ref`.
// Shared by every overlay row (highlights, AI comments, AI chats).
export function useDismissOnOutsideClick(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleDocumentClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [ref, isOpen, onDismiss]);
}
