import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useMasteryScroll(
  count: number,
  hasMore: boolean,
  load: () => void,
  idle: boolean,
) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef({ offset: 0, width: 0 });
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    function align() {
      if (!element) return;
      if (!element.clientWidth) {
        previous.current.width = 0;
        return;
      }
      const width = element.clientWidth;
      // display:none can reset scrollLeft; keep the last visible date instead.
      element.scrollLeft =
        element.scrollWidth - width - previous.current.offset * (width / 7);
      previous.current.width = width;
    }
    align();
    const observer = new ResizeObserver(align);
    observer.observe(element);
    return () => observer.disconnect();
  }, [count, hasMore]);
  function onScroll() {
    const element = ref.current;
    if (!element || !element.clientWidth) return;
    if (element.clientWidth !== previous.current.width) return;
    const fromEnd = Math.max(
      0,
      element.scrollWidth - element.clientWidth - element.scrollLeft,
    );
    previous.current.offset = fromEnd / (element.clientWidth / 7);
    setOffset(previous.current.offset);
    if (element.scrollLeft < element.clientWidth * 0.5 && hasMore && idle)
      void load();
  }
  function move(direction: number) {
    const element = ref.current;
    if (
      element &&
      direction < 0 &&
      element.scrollLeft < element.clientWidth * 0.5 &&
      hasMore
    )
      void load();
    if (element && element.clientWidth) {
      const width = element.clientWidth;
      const end = element.scrollWidth - width;
      const week = Math.round((end - element.scrollLeft) / width);
      element.scrollTo({
        left: Math.max(0, Math.min(end, end - (week - direction) * width)),
        // Prepending history cancels smooth scrolling at an intermediate day.
        behavior: "instant",
      });
    }
  }
  function today() {
    ref.current?.scrollTo({
      left: ref.current.scrollWidth,
      behavior: "smooth",
    });
  }
  const attach = useCallback((element: HTMLDivElement | null) => {
    ref.current = element;
  }, []);
  return { attach, onScroll, move, today, offset };
}
