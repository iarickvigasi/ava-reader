import { useLayoutEffect, useRef, useState } from "react";
import { toolbarVisibleItems } from "./toolbar-visible-items";

export function useToolbarOverflow(ids: string[]) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleIds, setVisibleIds] = useState(ids);
  const key = ids.join(",");
  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;
    const update = () => {
      const children = Array.from(measure.children);
      const widths = children.map(
        (child) => child.getBoundingClientRect().width,
      );
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      const trigger = widths.pop() ?? 0;
      const next = toolbarVisibleItems(
        widths,
        nav.clientWidth,
        gap,
        trigger,
        key.split(","),
      );
      setVisibleIds((previous) =>
        previous.join(",") === next.join(",") ? previous : next,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    observer.observe(measure);
    Array.from(measure.children).forEach((child) => observer.observe(child));
    update();
    return () => observer.disconnect();
  }, [key]);
  return { navRef, measureRef, visibleIds };
}
