"use client";
import { useAuth } from "@clerk/nextjs";
import { useReview } from "@/features/admin/pdf-reviews/use-review";
import { ReviewDetail } from "./review-detail";
export function PdfReviewManager({ ownerId }: { ownerId: string }) {
  const auth = useAuth();
  if (!auth.isLoaded || !auth.isSignedIn || auth.userId !== ownerId)
    return <p>Sign in with your authorized AVA review account.</p>;
  return (
    <ReviewSession
      key={`${auth.userId}:${auth.sessionId}`}
      getToken={auth.getToken}
    />
  );
}
function ReviewSession({
  getToken,
}: {
  getToken: () => Promise<string | null>;
}) {
  const state = useReview(getToken);
  return (
    <div className="space-y-6">
      <button
        className="rounded-control border border-line px-4 py-2"
        disabled={state.busy}
        onClick={() => void state.refresh()}
      >
        Refresh
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.busy && <p role="status">Loading review…</p>}
      <ul className="space-y-2" aria-label="Imports awaiting review">
        {state.rows.map((row) => (
          <li key={row.operationId}>
            <button
              disabled={state.busy}
              onClick={() => void state.select(row.operationId)}
              className="text-left underline"
            >
              {row.title} — {row.verdict.toLowerCase()}
            </button>
          </li>
        ))}
      </ul>
      {!state.busy && !state.rows.length && <p>No imports awaiting review.</p>}
      {state.detail && (
        <ReviewDetail
          key={state.detail.snapshot.validationId}
          detail={state.detail}
          request={state.request}
          pending={state.busy}
          decide={state.decide}
        />
      )}
    </div>
  );
}
