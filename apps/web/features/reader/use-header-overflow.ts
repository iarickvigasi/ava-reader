import { useEffect, useRef, useState } from "react";

export function useHeaderOverflow() {
  const rowRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const update = () => {
      setOverflowing(measure.getBoundingClientRect().width > row.clientWidth);
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    observer.observe(measure);
    update();
    return () => observer.disconnect();
  }, []);

  return { rowRef, measureRef, overflowing };
}
