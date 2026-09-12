import type { ReactNode } from "react";
import { useId } from "react";
import { AnnotationListActions } from "./annotation-list-actions";

type AnnotationColumnProps = {
  title: string;
  count: number;
  children: ReactNode;
  onCopy: () => Promise<void>;
};

export function AnnotationColumn({ title, count, children, onCopy }: AnnotationColumnProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 id={headingId} className="min-w-0 break-words font-display text-4xl leading-none text-title md:text-5xl">
            {title}
          </h2>
          <span className="shrink-0 font-ui text-sm tabular-nums text-muted">{count}</span>
        </div>
        <AnnotationListActions title={title} disabled={count === 0} onCopy={onCopy} />
      </div>
      <div
        role="region"
        aria-labelledby={headingId}
        tabIndex={0}
        className="max-h-dvh overflow-y-auto rounded-control pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong lg:max-h-none lg:overflow-visible lg:pr-0"
      >
        {children}
      </div>
    </section>
  );
}
