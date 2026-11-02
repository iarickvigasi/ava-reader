import { useEffect, useRef, useState } from "react";
import {
  allocateHeaderWidths,
  HEADER_FIELDS,
  type HeaderWidths,
} from "./allocate-header-widths";

export function useHeaderWidths({
  title,
  author,
  chapter,
}: {
  title: string;
  author?: string;
  chapter: string;
}) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<Partial<HeaderWidths>>({});

  useEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const elements = HEADER_FIELDS.map((field) =>
      measure.querySelector(`[data-field="${field}"]`),
    );
    const update = () => {
      const [title, author, chapter] = elements.map(
        (element) => element?.getBoundingClientRect().width ?? 0,
      );
      const natural = { title, author, chapter };
      const spacing =
        measure.getBoundingClientRect().width - title - author - chapter;
      setWidths(allocateHeaderWidths(natural, row.clientWidth - spacing));
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    observer.observe(measure);
    elements.forEach((element) => {
      if (element) observer.observe(element);
    });
    update();
    return () => observer.disconnect();
  }, [title, author, chapter]);

  return { rowRef, measureRef, widths };
}
