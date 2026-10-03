"use client";
import { useState } from "react";
import { ReviewDetail } from "@/components/app/admin/pdf-reviews/review-detail";
import type {
  ReviewInput,
  ReviewSnapshot,
  ReviewRequest,
} from "@/features/admin/pdf-reviews/types";
import type { CanonicalBookV2 } from "@/lib/api-types/canonical-reader.generated";
import { canApproveReview } from "@/features/admin/pdf-reviews/decision-policy";
import data from "./fixture-data.json";
const initial = data.snapshot as ReviewSnapshot;
const request: ReviewRequest = async (url) => {
  const encoded = (data.payloads as Record<string, string>)[url];
  if (!encoded) return new Response(null, { status: 404 });
  return new Response(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
};
export function ReviewFixture() {
  const [snapshot, setSnapshot] = useState(initial);
  const [key, setKey] = useState(0);
  async function decide(input: ReviewInput) {
    if (input.validationId !== snapshot.validationId) return;
    if (
      input.decision === "APPROVE" &&
      !canApproveReview(snapshot, input.findings)
    )
      return;
    setSnapshot({
      ...snapshot,
      status: input.decision === "REJECT" ? "FAILED" : "WAITING",
      decision: { ...input, decidedAt: new Date().toISOString() },
    });
  }
  function reset(blocked: boolean) {
    setKey((value) => value + 1);
    setSnapshot({
      ...initial,
      verdict: blocked ? "BLOCKED" : "REVIEW",
      hardBlocks: blocked ? ["missing_required_text"] : [],
    });
  }
  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <p>
        Authored review fixture · no authentication bypass, server decision or
        imported reader book
      </p>
      <div className="flex gap-4">
        <button onClick={() => reset(false)}>Reset reviewable</button>
        <button onClick={() => reset(true)}>Show hard block</button>
      </div>
      <ReviewDetail
        key={key}
        detail={{
          snapshot,
          book: data.book as CanonicalBookV2,
          report: data.report,
        }}
        request={request}
        pending={false}
        decide={decide}
      />
    </main>
  );
}
