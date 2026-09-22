import { useLayoutEffect, useRef, useState } from "react";

export const BILINGUAL_COLUMN_GAP = 48;

export function useBilingualSize() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const measure = () => {
      const width = Math.max(
        0,
        Math.floor((element.clientWidth - BILINGUAL_COLUMN_GAP) / 2),
      );
      const height = Math.max(0, Math.floor(element.clientHeight));
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
  }, []);
  return { surfaceRef, size };
}
