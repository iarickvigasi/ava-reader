import { withDeadline } from "@/features/auth/with-deadline";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReaderProgressPayload } from "@/lib/api-types";
import type { ProgressWrite, ProgressSyncOptions } from "./types";

export async function postProgress(
  token: string,
  libraryItemId: string,
  write: ProgressWrite,
  options: ProgressSyncOptions = {},
): Promise<ReaderProgressPayload> {
  const controller = new AbortController();
  try {
    return await withDeadline(
      sendProgress(token, libraryItemId, write, {
        ...options,
        signal: controller.signal,
      }),
    );
  } finally {
    controller.abort();
  }
}

async function sendProgress(
  token: string,
  libraryItemId: string,
  write: ProgressWrite,
  options: ProgressSyncOptions & { signal: AbortSignal },
): Promise<ReaderProgressPayload> {
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(libraryItemId)}/reader/progress`,
    {
      method: "PATCH",
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(write),
    },
  );
  if (!response.ok) throw new Error("Reader progress could not be saved");
  return response.json();
}
