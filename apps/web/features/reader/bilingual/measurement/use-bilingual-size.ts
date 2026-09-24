import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { bilingualPaneSize } from "./bilingual-pane-size";
import { useLayoutEffect, useRef, useState } from "react";

export function useBilingualSize() {
  const { isPhone } = useReaderUi();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = bilingualPaneSize(
        element.clientWidth,
        element.clientHeight,
        isPhone,
      );
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const frame = requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [isPhone]);
  return { surfaceRef, size };
}
