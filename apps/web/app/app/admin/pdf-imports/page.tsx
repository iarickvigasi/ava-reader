import Link from "next/link";
import { PdfReviewManager } from "@/components/app/admin/pdf-reviews/manager";
export const dynamic = "force-dynamic";
export default function PdfImportReviewsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <p className="text-sm text-muted">Internal admin</p>
      <h1 className="font-display text-4xl">PDF import review</h1>
      <Link
        href="/app/admin/pdf-reports"
        prefetch={false}
        className="underline"
      >
        Investigate conversion reports and costs
      </Link>
      <PdfReviewManager />
    </main>
  );
}
