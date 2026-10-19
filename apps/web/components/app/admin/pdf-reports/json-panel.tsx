import type { ReportValue } from "@/features/admin/pdf-reports/types";
export function ReportJsonPanel({
  title,
  value,
}: {
  title: string;
  value: ReportValue;
}) {
  return (
    <details className="rounded-card bg-surface p-4">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
