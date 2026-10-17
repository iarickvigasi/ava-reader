import { reportHref } from "@/features/admin/pdf-reports/query";
import { object } from "@/features/admin/pdf-reports/parse-response";
import type {
  ReportData,
  ReportValue,
} from "@/features/admin/pdf-reports/types";

export function ReportLookupResults({ report }: { report: ReportData }) {
  const { value } = report;
  return (
    <section className="space-y-3" aria-label="Matching investigations">
      <h2 className="font-display text-3xl">Matching investigations</h2>
      <p>
        {value.complete === true
          ? "All matching results are shown."
          : "This lookup is incomplete; refine with an exact operation or investigation reference."}
      </p>
      {report.omittedFields > 0 && (
        <p role="status">Some fields are unsupported by this viewer.</p>
      )}
      <ul className="space-y-2">
        {(value.results as ReportValue[]).map((item) => {
          const row = object(item),
            id = String(row.conversionId);
          return (
            <li key={id}>
              <a
                className="break-all underline"
                href={reportHref({
                  kind: "conversionId",
                  reference: id,
                  view: "snapshot",
                })}
              >
                {id} · {String(row.status)} · {String(row.stage)}
              </a>
            </li>
          );
        })}
      </ul>
      {Array.isArray(value.results) && value.results.length === 0 && (
        <p>No matching investigations.</p>
      )}
    </section>
  );
}
