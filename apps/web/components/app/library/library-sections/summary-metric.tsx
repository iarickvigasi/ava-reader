type SummaryMetricProps = {
  label: string;
  value: number;
};

export function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <div>
      <p className="font-display text-[2rem] leading-none text-title md:text-[2.25rem]">
        {value}
      </p>
      <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
    </div>
  );
}

export function SummaryMetricSkeleton() {
  return (
    <div>
      <div className="h-8 w-12 animate-pulse rounded bg-paper-strong md:h-9" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-paper-strong" />
    </div>
  );
}
