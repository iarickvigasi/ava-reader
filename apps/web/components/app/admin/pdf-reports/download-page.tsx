"use client";
import { Button } from "@/components/ui/button";
import type { ReportData } from "@/features/admin/pdf-reports/types";
export function DownloadReportPage({ report }: { report: ReportData }) {
  function download() {
    const body = {
      viewerProjection: { omittedFields: report.omittedFields },
      ...report.value,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "conversion-report-page.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Button type="button" size="sm" onClick={download}>
      Download this JSON page
    </Button>
  );
}
