"use client";
import { useState } from "react";
import type {
  ReviewInput,
  ReviewSnapshot,
} from "@/features/admin/pdf-reviews/types";
import { canApproveReview } from "@/features/admin/pdf-reviews/decision-policy";
export function ReviewDecision({
  item,
  pending,
  decide,
}: {
  item: ReviewSnapshot;
  pending: boolean;
  decide: (input: ReviewInput) => Promise<void>;
}) {
  const [accepted, setAccepted] = useState<string[]>([]);
  const blocked = item.hardBlocks.length > 0 || item.verdict === "BLOCKED";
  const send = (decision: "APPROVE" | "REJECT") =>
    void decide({
      validationId: item.validationId,
      decision,
      findings: decision === "APPROVE" ? accepted : item.reviewFindings,
    });
  if (item.decision)
    return (
      <p role="status">
        Decision saved: {item.decision.decision.toLowerCase()}.{" "}
        {item.decision.decision === "APPROVE"
          ? "Publication still requires all validation and reader checks."
          : "The import remains failed."}
      </p>
    );
  return (
    <div className="space-y-4">
      {blocked && (
        <div role="alert">
          <p>This candidate cannot be approved.</p>
          <ul>
            {item.hardBlocks.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={pending || blocked} className="space-y-3">
        <legend className="font-semibold">Findings requiring a decision</legend>
        {item.reviewFindings.map((code) => (
          <label key={code} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={accepted.includes(code)}
              onChange={(event) =>
                setAccepted((old) =>
                  event.target.checked
                    ? [...old, code]
                    : old.filter((c) => c !== code),
                )
              }
            />
            <span>{code}</span>
          </label>
        ))}
        {!item.reviewFindings.length && <p>No permitted review findings.</p>}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending || !canApproveReview(item, accepted)}
          onClick={() => send("APPROVE")}
          className="rounded-control bg-brand-fill px-4 py-2 text-brand-foreground disabled:opacity-40"
        >
          Accept selected findings
        </button>
        <button
          disabled={pending || blocked}
          onClick={() => send("REJECT")}
          className="rounded-control border border-line px-4 py-2"
        >
          Reject candidate
        </button>
      </div>
    </div>
  );
}
