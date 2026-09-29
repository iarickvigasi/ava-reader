import {
  reviewPath,
  type ReviewInput,
  type ReviewRequest,
  type ReviewSnapshot,
} from "./types";
export async function postReviewDecision(
  request: ReviewRequest,
  operationId: string,
  input: ReviewInput,
) {
  const result = (await (
    await request(reviewPath(operationId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  ).json()) as ReviewSnapshot;
  if (
    result.operationId !== operationId ||
    result.validationId !== input.validationId
  )
    throw new Error("Review identity mismatch.");
  return result;
}
