import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { fetchServerApiResult } from "@/lib/server-api";
import { PdfReviewManager } from "@/components/app/admin/pdf-reviews/manager";
export const dynamic = "force-dynamic";
export default async function PdfImportReviewsPage() {
  const identity = await auth();
  const access = await fetchServerApiResult("/api/admin/pdf-imports/reviews");
  if (!identity.userId || access.status === "authUnavailable") notFound();
  if (access.status === "apiUnavailable")
    return <p>Review is unavailable while the API is offline.</p>;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <p className="text-sm text-muted">Internal admin</p>
      <h1 className="font-display text-4xl">PDF import review</h1>
      <PdfReviewManager ownerId={identity.userId} />
    </main>
  );
}
