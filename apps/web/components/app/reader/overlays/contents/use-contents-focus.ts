import { useEffect, useRef } from "react";
import { restoreControlFocus } from "../restore-control-focus";

export function useContentsFocus() {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const origin = document.activeElement;
    const pathname = window.location.pathname;
    const current = panel.current?.querySelector<HTMLElement>(
      "button[aria-current=location]",
    );
    const first = panel.current?.querySelector<HTMLElement>(
      "button:not(:disabled), summary",
    );
    (current ?? first)?.focus();
    return () => {
      restoreControlFocus(
        origin,
        pathname,
        '[data-reader-panel-control="contents"]',
      );
    };
  }, []);
  return panel;
}
