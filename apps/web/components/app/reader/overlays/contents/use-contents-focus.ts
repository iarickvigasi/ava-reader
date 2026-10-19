import { useEffect, useRef } from "react";

export function useContentsFocus() {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const current = panel.current?.querySelector<HTMLElement>(
      "button[aria-current=location]",
    );
    const first = panel.current?.querySelector<HTMLElement>(
      "button:not(:disabled), summary",
    );
    (current ?? first)?.focus();
  }, []);
  return panel;
}
