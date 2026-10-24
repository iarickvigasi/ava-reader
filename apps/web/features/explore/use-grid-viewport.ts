"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

import {
  measureGridViewport,
  type GridViewport,
} from "./measure-grid-viewport";
export type { GridViewport } from "./measure-grid-viewport";

export function useGridViewport(ref: RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState<GridViewport>({
    columns: 2,
    rowHeight: 440,
    top: 0,
    scroll: 0,
    height: 800,
  });
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;
    const measure = () => {
      const next = measureGridViewport(grid);
      if (!next) return;
      setViewport((old) =>
        Object.keys(next).every(
          (key) =>
            next[key as keyof GridViewport] === old[key as keyof GridViewport],
        )
          ? old
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);
  return viewport;
}
