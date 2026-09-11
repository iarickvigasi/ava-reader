import type { ReactNode } from "react";
import { useId } from "react";

type AnnotationColumnProps = {
  title: string;
  count: number;
  children: ReactNode;
};

export function AnnotationColumn({ title, count, children }: AnnotationColumnProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-6">
      <div className="flex items-baseline gap-3">
        <h2 id={headingId} className="font-display text-4xl leading-none text-title md:text-5xl">
          {title}
        </h2>
        <span className="font-ui text-sm tabular-nums text-muted">{count}</span>
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
