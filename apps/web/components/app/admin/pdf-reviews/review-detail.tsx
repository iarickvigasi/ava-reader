"use client";
import { ReviewDecision } from "./review-decision";
import type { loadReviewSnapshot } from "@/features/admin/pdf-reviews/load-snapshot";
import type {
  ReviewInput,
  ReviewRequest,
} from "@/features/admin/pdf-reviews/types";
import { CandidateText } from "./candidate-text";
import { ReviewArtifactButton } from "./artifact-button";
export function ReviewDetail({
  detail,
  request,
  pending,
  decide,
}: {
  detail: Awaited<ReturnType<typeof loadReviewSnapshot>>;
  request: ReviewRequest;
  pending: boolean;
  decide: (input: ReviewInput) => Promise<void>;
}) {
  const { snapshot: item, book, report } = detail;
  return (
    <section
      className="space-y-6 rounded-modal border border-line p-5"
      aria-label="Selected import review"
    >
      <h2 className="font-display text-3xl">{item.title}</h2>
      <p className="text-sm text-muted">
        {item.status} · Validation {item.validationId}
      </p>
      <div className="flex flex-wrap gap-3">
        <ReviewArtifactButton
          operationId={item.operationId}
          file={item.source}
          label="Download source PDF"
          filename="source.pdf"
          request={request}
        />
        <ReviewArtifactButton
          operationId={item.operationId}
          file={item.candidate}
          label="Download candidate EPUB"
          filename="candidate.epub"
          request={request}
        />
        <ReviewArtifactButton
          operationId={item.operationId}
          file={item.report}
          label="Evidence report"
          filename="evidence.json"
          request={request}
        />
      </div>
      <details>
        <summary>Artifact identities</summary>
        <dl className="break-all text-xs">
          <dt>Source SHA-256</dt>
          <dd>{item.source.sha256}</dd>
          <dt>Candidate SHA-256</dt>
          <dd>{item.candidate.sha256}</dd>
        </dl>
      </details>
      <details>
        <summary>Source evidence and actionable findings</summary>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
      <CandidateText book={book} />
      <ReviewDecision item={item} pending={pending} decide={decide} />
    </section>
  );
}
