import { useLayoutEffect, useRef } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import {
  isStickyRestoreIntent,
  type RestoreIntent,
} from "@/features/reader/navigation";

// Page numbers can change during reflow. Keep the passage until navigation,
// rather than treating a recycled page number as proof of an old restore.
export function useRestorePositionPin(input: {
  activeChapterId: string;
  cancelSettle: () => void;
  currentPageIndex: number;
  restoreIntent: RestoreIntent | null;
}) {
  const position = useRef({
    consumedKey: null as string | null,
    sticky: false,
    restorePage: null as number | null,
    appliedPage: null as number | null,
    visibleAnchor: null as ReaderLocator | null,
  });
  const { activeChapterId, cancelSettle, currentPageIndex, restoreIntent } =
    input;
  useLayoutEffect(() => {
    cancelSettle();
    position.current = {
      consumedKey: null,
      sticky: isStickyRestoreIntent(restoreIntent),
      restorePage: null,
      appliedPage: null,
      visibleAnchor: null,
    };
  }, [activeChapterId, cancelSettle, restoreIntent]);
  useLayoutEffect(() => {
    const pin = position.current;
    // Restore decisions record their applied page before updating page state.
    // A different committed page therefore comes from ordinary page navigation.
    if (pin.appliedPage !== null && currentPageIndex !== pin.appliedPage) {
      pin.restorePage = null;
      pin.sticky = false;
      pin.visibleAnchor = null;
    }
  }, [currentPageIndex]);
  return position;
}
