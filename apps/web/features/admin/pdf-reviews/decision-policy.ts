import type { ReviewSnapshot } from "./types";
export function canApproveReview(item: ReviewSnapshot, selected: string[]) {
  return (
    !item.decision &&
    item.verdict === "REVIEW" &&
    !item.hardBlocks.length &&
    new Set(selected).size === selected.length &&
    selected.length === item.reviewFindings.length &&
    item.reviewFindings.every((code) => selected.includes(code))
  );
}
