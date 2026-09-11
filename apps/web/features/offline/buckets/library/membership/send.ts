import { getPublicApiBaseUrl } from "@/lib/api";
import type { LibraryBookCollectionsPayload } from "@/lib/api-types/library";
import { classifyFailure, type FailureResult } from "../../shared/http";
import type { MembershipMutation } from "./types";

export async function sendMembership(
  mutation: MembershipMutation,
  token: string,
): Promise<FailureResult | { kind: "saved"; payload: LibraryBookCollectionsPayload }> {
  try {
    const response = await fetch(`${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(mutation.libraryItemId)}/collections`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        addCollectionIds: mutation.changes.filter((change) => change.member).map((change) => change.collectionId),
        removeCollectionIds: mutation.changes.filter((change) => !change.member).map((change) => change.collectionId),
      }),
    });
    if (!response.ok) return classifyFailure(response);
    const payload = await response.json() as LibraryBookCollectionsPayload;
    if (payload.libraryItemId !== mutation.libraryItemId || !Array.isArray(payload.collections) || !Array.isArray(payload.affectedCollections)) {
      return { kind: "retry" };
    }
    return { kind: "saved", payload };
  } catch {
    return { kind: "retry" };
  }
}
