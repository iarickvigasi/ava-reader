import { formatUsdNano } from "@/features/admin/pdf-reports/format-cost";
import type { ReportObject } from "@/features/admin/pdf-reports/types";
export function ReportCostPanel({ value }: { value: ReportObject }) {
  return (
    <section className="space-y-3" aria-label="Provider cost">
      <h2 className="font-display text-3xl">Provider cost</h2>
      <p>
        Projection: {String(value.state ?? "Unknown")} ·{" "}
        {value.actualComplete === true
          ? "Final actual amount verified"
          : "Final actual amount is not verified"}
      </p>
      <dl className="grid gap-2 sm:grid-cols-3">
        {[
          ["Known actual", "knownActualNano"],
          ["Reserved", "reservedNano"],
          ["Uncertain exposure", "uncertainNano"],
        ].map(([label, key]) => (
          <div key={key}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-all font-semibold">
              {formatUsdNano(value[key])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">
        Amounts preserve all nine decimal places. Unknown is not zero. Each
        provider call counts once; infrastructure cost is unmeasured. This view
        cannot settle or release charges.
      </p>
    </section>
  );
}
