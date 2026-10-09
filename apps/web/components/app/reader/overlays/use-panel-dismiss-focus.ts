import { useCallback, useEffect, useRef } from "react";
import type { ReaderPanel } from "@/components/app/core/reader-ui-context";
import { restoreControlFocus } from "./restore-control-focus";
import { readerPanelControl } from "@/features/reader/panel-id";

export function usePanelDismissFocus(
  panel: ReaderPanel | null,
  onClose: () => void,
) {
  const opening = useRef<{
    panel: ReaderPanel;
    element: Element | null;
    pathname: string;
  } | null>(null);
  useEffect(() => {
    const active = document.activeElement;
    opening.current = panel
      ? {
          panel,
          element: active?.matches(readerPanelControl(panel))
            ? active
            : null,
          pathname: window.location.pathname,
        }
      : null;
  }, [panel]);
  return useCallback(() => {
    const captured = opening.current;
    onClose();
    if (!captured || captured.panel !== panel) return;
    restoreControlFocus(
      captured.element,
      captured.pathname,
      readerPanelControl(panel),
    );
  }, [onClose, panel]);
}
