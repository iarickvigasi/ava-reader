import { useCallback, useRef } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { ReadyReaderProps } from "../shared/types";

// Keep the exact landed passage through reflow. Only an actual user page turn
// releases it; remeasurement can change page-start without leaving the passage.
export function useJumpOrigin(props: ReadyReaderProps) {
  const { onVisibleLocatorChange, visibleLocator, displayLocator } = props;
  const landed = useRef<ReaderLocator | null>(null);
  const origin = useCallback(
    () => landed.current ?? visibleLocator ?? displayLocator,
    [visibleLocator, displayLocator],
  );
  const arrive = useCallback((target: ReaderLocator) => {
    landed.current = target;
  }, []);
  const leavePassage = useCallback(() => {
    landed.current = null;
  }, []);
  return {
    origin,
    arrive,
    leavePassage,
    visibleChanged: onVisibleLocatorChange,
  };
}
