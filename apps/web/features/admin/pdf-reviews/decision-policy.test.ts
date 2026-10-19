import { describe, expect, it } from "vitest";
import { canApproveReview } from "./decision-policy";
import { postReviewDecision } from "./post-decision";
import type { ReviewSnapshot } from "./types";
const item = {
  verdict: "REVIEW",
  hardBlocks: [],
  reviewFindings: ["cosmetic-a", "cosmetic-b"],
  decision: null,
} as unknown as ReviewSnapshot;
describe("review decision authority", () => {
  it("requires every exact finding, without duplicates or unknowns", () => {
    expect(canApproveReview(item, ["cosmetic-b", "cosmetic-a"])).toBe(true);
    for (const choices of [
      [],
      ["cosmetic-a"],
      ["cosmetic-a", "cosmetic-a"],
      ["cosmetic-a", "cosmetic-b", "unknown"],
    ])
      expect(canApproveReview(item, choices)).toBe(false);
  });
  it("cannot override hard blocks or an existing decision", () => {
    expect(
      canApproveReview(
        { ...item, hardBlocks: ["missing-text"] },
        item.reviewFindings,
      ),
    ).toBe(false);
    expect(
      canApproveReview({ ...item, verdict: "BLOCKED" }, item.reviewFindings),
    ).toBe(false);
    expect(
      canApproveReview(
        {
          ...item,
          decision: { decision: "REJECT", findings: [], decidedAt: "now" },
        },
        item.reviewFindings,
      ),
    ).toBe(false);
  });
  it("rejects a response for a different validation or operation", async () => {
    const input = {
      validationId: "current",
      decision: "APPROVE" as const,
      findings: [],
    };
    for (const result of [
      { operationId: "other", validationId: "current" },
      { operationId: "op", validationId: "old" },
    ])
      await expect(
        postReviewDecision(async () => Response.json(result), "op", input),
      ).rejects.toThrow("identity mismatch");
  });
});
