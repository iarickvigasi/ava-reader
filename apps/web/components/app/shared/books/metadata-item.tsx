import type { ReactNode } from "react";

export function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 wrap-anywhere">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 font-reader text-lg leading-7 text-copy-strong">
        {value}
      </p>
    </div>
  );
}
