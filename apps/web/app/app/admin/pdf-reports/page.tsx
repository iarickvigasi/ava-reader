import Link from "next/link";
import { ScreenContainer } from "@/components/ui/screen-container";
import { ReportClient } from "@/components/app/admin/pdf-reports/client";
import {
  parseReportQuery,
  type Search,
} from "@/features/admin/pdf-reports/query";

export const dynamic = "force-dynamic";
export default async function PdfReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  let search: Search = {},
    invalidSearch = false;
  try {
    search = { ...parseReportQuery(await searchParams) };
  } catch {
    invalidSearch = true;
  }
  return (
    <ScreenContainer className="gap-6 py-8">
      <p className="font-ui text-xs uppercase tracking-[0.16em] text-muted">
        Internal admin
      </p>
      <h1 className="font-display text-4xl text-title">
        PDF conversion reports
      </h1>
      <p className="max-w-3xl text-copy">
        Read saved investigation, timeline, and provider cost evidence. This
        page is online-only and does not change an import or its accounting.
      </p>
      <Link
        href="/app/admin/pdf-imports"
        prefetch={false}
        className="underline"
      >
        Back to PDF import review
      </Link>
      <ReportClient search={search} invalidSearch={invalidSearch} />
    </ScreenContainer>
  );
}
