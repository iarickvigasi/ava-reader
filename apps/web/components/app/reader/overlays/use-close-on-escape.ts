import { useEffect } from "react";
import { READER_KEY_ESCAPE } from "../shared/constants";

export function useCloseOnEscape(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== READER_KEY_ESCAPE) {
        return;
      }

      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);
}
