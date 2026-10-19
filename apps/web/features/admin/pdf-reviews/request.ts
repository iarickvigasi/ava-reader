import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReviewFile, ReviewRequest } from "./types";

export function reviewRequest(
  getToken: () => Promise<string | null>,
  signal: AbortSignal,
): ReviewRequest {
  return async (path, init = {}) => {
    if (!path.startsWith("/api/admin/pdf-imports/") || /[?#\\]/.test(path))
      throw new Error("Invalid review path");
    signal.throwIfAborted();
    const token = await getToken();
    signal.throwIfAborted();
    if (!token) throw new Error("Sign in again to review imports.");
    const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
      ...init,
      signal,
      cache: "no-store",
      redirect: "error",
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    signal.throwIfAborted();
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? "AVA review access is required."
          : "Review is unavailable. Refresh before trying again.",
      );
    return response;
  };
}
export async function reviewArtifact(
  request: ReviewRequest,
  operationId: string,
  file: ReviewFile,
) {
  const expected = `/api/admin/pdf-imports/${encodeURIComponent(operationId)}/review/artifacts/${encodeURIComponent(file.artifactId)}`;
  if (
    file.url !== expected ||
    !Number.isSafeInteger(file.byteLength) ||
    !/^[a-f0-9]{64}$/.test(file.sha256) ||
    file.byteLength < 1 ||
    file.byteLength > 256 * 1024 ** 2
  )
    throw new Error("Invalid review artifact.");
  const response = await request(file.url);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty review artifact.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > file.byteLength)
        throw new Error("Review artifact size mismatch.");
      chunks.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel();
  }
  const blob = new Blob(chunks, { type: file.mediaType });
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (length !== file.byteLength || hash !== file.sha256)
    throw new Error("Review artifact hash mismatch.");
  return blob;
}
