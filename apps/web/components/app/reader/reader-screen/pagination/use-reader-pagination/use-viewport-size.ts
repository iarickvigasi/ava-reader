import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getBrowserViewportHeight } from "../../shared/utils";
import type { PageBoxSize } from "../../shared/types";

export function useViewportSize() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);

  const [availableHeight, setAvailableHeight] = useState(0);
  const [pageBoxSize, setPageBoxSize] = useState<PageBoxSize>({
    height: 0,
    width: 0,
  });

  const syncAvailableHeight = useCallback(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const viewportHeight = getBrowserViewportHeight();
    const rootTop = root.getBoundingClientRect().top;
    const nextHeight = Math.max(320, Math.floor(viewportHeight - rootTop));

    setAvailableHeight((current) =>
      current === nextHeight ? current : nextHeight,
    );
  }, []);

  useEffect(() => {
    syncAvailableHeight();

    const visualViewport = window.visualViewport;
    const handleResize = () => {
      syncAvailableHeight();
    };

    window.addEventListener("resize", handleResize);
    visualViewport?.addEventListener("resize", handleResize);
    visualViewport?.addEventListener("scroll", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, [syncAvailableHeight]);

  const syncPageBoxSize = useCallback(() => {
    const pageBox = pageBoxRef.current;

    if (!pageBox) {
      return;
    }

    const nextSize = {
      height: Math.floor(pageBox.clientHeight),
      width: Math.floor(pageBox.clientWidth),
    };

    setPageBoxSize((current) =>
      current.width === nextSize.width && current.height === nextSize.height
        ? current
        : nextSize,
    );
  }, []);

  useEffect(() => {
    syncPageBoxSize();

    const pageBox = pageBoxRef.current;
    if (!pageBox) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncPageBoxSize();
    });
    resizeObserver.observe(pageBox);

    return () => {
      resizeObserver.disconnect();
    };
  }, [syncPageBoxSize]);

  return {
    availableHeight,
    pageBoxRef,
    pageBoxSize,
    rootRef,
  };
}
