import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useMasteryScroll(
  count: number,
  hasMore: boolean,
  load: () => void,
  idle: boolean,
) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef({ count: 0, more: false, width: 0 });
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    function align() {
      if (!element || !element.clientWidth) return;
      const old = previous.current;
      const width = element.clientWidth;
      if (!old.count) element.scrollLeft = element.scrollWidth;
      else {
        const position = old.width ? element.scrollLeft / old.width : 0;
        element.scrollLeft =
          (position +
            (count - old.count) / 7 +
            Number(hasMore) -
            Number(old.more)) *
          width;
      }
      previous.current = { count, more: hasMore, width };
    }
    align();
    const observer = new ResizeObserver(align);
    observer.observe(element);
    return () => observer.disconnect();
  }, [count, hasMore]);
  function onScroll() {
    const element = ref.current;
    if (!element || !element.clientWidth) return;
    const fromEnd = Math.max(
      0,
      element.scrollWidth - element.clientWidth - element.scrollLeft,
    );
    setOffset(fromEnd / (element.clientWidth / 7));
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
