import { getPublicApiBaseUrl } from "@/lib/api";

import { isCurrentTranslationBucket } from "./bucket";
import { extractReason } from "../shared/http";
import { TranslationRequestError } from "./request-error";
import { requestWithDeadline } from "./request-with-deadline";
import type { TranslationBucket } from "./types";

export async function requestTranslation(
  bucket: TranslationBucket,
  suffix: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<unknown> {
  const token = await bucket.getToken?.();
  signal.throwIfAborted();
  if (!token || !isCurrentTranslationBucket(bucket))
    throw new Error("Sign in to translate this page.");
  const path = `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(bucket.scope.libraryItemId)}/translations`;
  return requestWithDeadline(async (requestSignal) => {
    const response = await fetch(`${path}${suffix}`, {
      method: body ? "POST" : "GET",
      signal: requestSignal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new TranslationRequestError(
        await extractReason(response),
        response.status,
      );
    return response.json();
  }, signal);
}
