import type { CanonicalBookV2 } from "@/lib/api-types/canonical-reader.generated";
import { reviewArtifact } from "./request";
import { reviewPath, type ReviewRequest, type ReviewSnapshot } from "./types";
export async function loadReviewSnapshot(request: ReviewRequest, id: string) {
  const snapshot = (await (
    await request(reviewPath(id))
  ).json()) as ReviewSnapshot;
  if (snapshot.operationId !== id) throw new Error("Review identity mismatch.");
  const [canonical, report] = await Promise.all([
    reviewArtifact(request, id, snapshot.canonical),
    reviewArtifact(request, id, snapshot.report),
  ]);
  const book = JSON.parse(await canonical.text()) as CanonicalBookV2;
  if (
    book.schema_version !== "ava-book-2" ||
    !Array.isArray(book.chapters) ||
    !Array.isArray(book.blocks)
  )
    throw new Error("Unsupported review content.");
  return { snapshot, book, report: JSON.parse(await report.text()) as unknown };
}
