import Link from "next/link";
import {
  reportHref,
  reportViews,
  type ReportQuery,
} from "@/features/admin/pdf-reports/query";
import type { ReportData } from "@/features/admin/pdf-reports/types";
import { ReportJsonPanel } from "./json-panel";
import { ReportCostPanel } from "./cost-panel";
import { DownloadReportPage } from "./download-page";
import { ReportLookupResults } from "./lookup-results";

export function ReportResult({
  query,
  report,
}: {
  query: ReportQuery;
  report: ReportData;
}) {
  const value = report.value;
  if (query.kind !== "conversionId")
    return <ReportLookupResults report={report} />;
  const cursorKey = query.view === "cost" ? "costCursor" : "eventCursor";
  return (
    <section className="space-y-5" aria-label="Conversion investigation">
      <h2 className="break-all font-display text-3xl">
        Investigation {query.reference}
      </h2>
      <nav aria-label="Report views" className="flex flex-wrap gap-4">
        {reportViews.map((view) => (
          <Link
            prefetch={false}
            key={view}
            className="capitalize underline"
            aria-current={view === query.view ? "page" : undefined}
            href={reportHref({ ...query, view })}
          >
            {view === "events" ? "Timeline" : view}
          </Link>
        ))}
      </nav>
      {report.omittedFields > 0 && (
        <p role="status">
          This viewer omits {report.omittedFields} unsupported fields. Its JSON
          is a projection, not a complete API payload.
        </p>
      )}
      {query.view === "snapshot" && (
        <p>
          Status: {String(value.status)} · Stage: {String(value.stage)} ·
          Capture: {String(value.coverage)}. Evidence gaps and observation
          coverage are retained below; coverage does not establish source
          fidelity.
        </p>
      )}
      {query.view === "events" && (
        <p>
          Timeline watermark {String(value.watermark)}.{" "}
          {report.nextCursor
            ? "More events remain."
            : "End of this timeline snapshot."}{" "}
          A complete page sequence does not establish complete measurements.
        </p>
      )}
      {query.view === "cost" && <ReportCostPanel value={value} />}
      {query.view === "export" && (
        <>
          <p>
            One timeline page and the first cost page. Each has its own
            continuation cursor; this is not the complete investigation history.
          </p>
          <DownloadReportPage report={report} />
        </>
      )}
      <ReportJsonPanel title="Safe report fields" value={value} />
      {query.view !== "snapshot" && (
        <div className="flex flex-wrap gap-4">
          <Link
            prefetch={false}
            className="underline"
            href={reportHref({ ...query, [cursorKey]: undefined })}
          >
            Start this view again
          </Link>
          {report.nextCursor && (
            <Link
              prefetch={false}
              className="underline"
              href={reportHref({ ...query, [cursorKey]: report.nextCursor })}
            >
              Next {query.view === "cost" ? "cost" : "timeline"} page
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
