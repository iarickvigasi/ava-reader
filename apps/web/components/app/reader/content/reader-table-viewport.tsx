import type { CSSProperties, ReactNode } from "react";
import { useReaderMeasurement } from "./reader-measurement-context";

// A scroll box stays in one reading column. Tall tables remain reachable inside
// that box rather than overflowing a page or losing their final rows.
export function ReaderTableViewport({
  children,
  pageHeight,
  breakBefore,
}: {
  children: ReactNode;
  pageHeight: number;
  breakBefore?: CSSProperties["breakBefore"];
}) {
  const measurement = useReaderMeasurement();
  return (
    <div
      data-reader-table-scroll
      tabIndex={measurement ? undefined : 0}
      className="w-full max-w-full overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      style={{
        breakInside: "avoid",
        breakBefore,
        maxHeight: pageHeight > 0 ? pageHeight : undefined,
      }}
    >
      {children}
    </div>
  );
}
