import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReadingReview } from "@/lib/api-types/reading-review";

export async function publishReview(
  entry: ReadingReview,
  form: HTMLFormElement,
  getToken: () => Promise<string | null>,
  action = "publish",
) {
  const fields = new FormData(form);
  const token = await getToken();
  if (!token) throw new Error("Sign in again to publish");
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/admin/reading-imports/${action === "unpublish" ? "unpublish" : "publish"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        editionId: entry.editionId,
        checksum: entry.checksum,
        review:
          action === "defer"
            ? { reviewDeferred: true }
            : entry.status === "PUBLISHED" && entry.syncPending
              ? undefined
              : {
                  rightsStatement: fields.get("rightsStatement"),
                  rightsUrl: fields.get("rightsUrl"),
                  rightsJurisdiction: fields.get("rightsJurisdiction"),
                  notes: fields.get("notes"),
                  rightsConfirmed: fields.get("rightsConfirmed") === "on",
                  qualityConfirmed: fields.get("qualityConfirmed") === "on",
                },
      }),
    },
  );
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      error?.message ?? "Publication failed. You can retry this action.",
    );
  }
}
