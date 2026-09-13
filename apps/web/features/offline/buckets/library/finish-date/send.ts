import { getPublicApiBaseUrl } from "@/lib/api";
import { classifyFailure, type FailureResult } from "../../shared/http";
import type { FinishDateMutation } from "./types";

export async function sendFinishDate(
  mutation: FinishDateMutation,
  token: string,
): Promise<FailureResult | { kind: "saved"; finishedAt: string | null }> {
  try {
    const response = await fetch(`${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(mutation.libraryItemId)}/finished`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ finishedAt: mutation.finishedAt }),
    });
    if (!response.ok) return classifyFailure(response);
    const payload = await response.json() as { libraryItemId?: unknown; finishedAt?: unknown };
    const date = payload.finishedAt;
    if (payload.libraryItemId !== mutation.libraryItemId ||
      (date !== null && (typeof date !== "string" || !Number.isFinite(Date.parse(date))))) {
      return { kind: "retry" };
    }
    return { kind: "saved", finishedAt: date };
  } catch {
    return { kind: "retry" };
  }
}
