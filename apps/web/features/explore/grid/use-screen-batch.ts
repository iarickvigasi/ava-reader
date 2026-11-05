"use client";

import { useEffect, useRef, useState } from "react";
import { screenBatchSize } from "./screen-batch-size";

export function useScreenBatch() {
  const gridRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ first: number; next: number } | null>(
    null,
  );
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const box = grid.getBoundingClientRect();
      if (box.width <= 0) return;
      const columns = getComputedStyle(grid)
        .gridTemplateColumns.trim()
        .split(/\s+/).length;
      const input = { width: box.width, height: window.innerHeight, columns };
      const first = screenBatchSize({
        ...input,
        top: box.top + window.scrollY,
      });
      const next = screenBatchSize({ ...input, top: 0 });
      setSize((old) =>
        old?.first === first && old.next === next ? old : { first, next },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return { gridRef, size };
}
