import { READER_CAPABILITY_HEADERS } from "./headers";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { canonicalPayload } from "./payload";

const MAX_RESOURCE_BYTES = 200 * 1024 * 1024;
const MAX_BOOK_RESOURCE_BYTES = 200 * 1024 * 1024;

export async function loadCanonicalResources(
  payload: ReaderStatusPayload,
  input: { token: string; apiBase: string; signal?: AbortSignal },
): Promise<ReaderStatusPayload> {
  if (payload.status !== "READY" || !payload.readerPackage) return payload;
  const urls: Record<string, string> = {};
  let total = 0;
  for (const resource of payload.readerPackage.book.resources) {
    total += resource.byte_length;
    if (
      resource.byte_length > MAX_RESOURCE_BYTES ||
      total > MAX_BOOK_RESOURCE_BYTES
    )
      throw new Error("Reader resource limit");
    const url = new URL(
      payload.resourceUrls?.[resource.id] ?? "",
      input.apiBase,
    );
    const base = new URL(input.apiBase);
    if (
      url.origin !== base.origin ||
      !/^(?:\/api)?\/library\/(?:pdf-imports\/[^/]+\/(?:artifacts|resources)|epub-imports\/[^/]+\/resources)\/[^/]+$/.test(
        url.pathname,
      )
    )
      throw new Error("Invalid owned resource URL");
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${input.token}`,
        ...READER_CAPABILITY_HEADERS,
      },
      signal: input.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok || !response.body)
      throw new Error("Reader resource unavailable");
    const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > resource.byte_length) {
        await reader.cancel();
        throw new Error("Reader resource length mismatch");
      }
      chunks.push(value);
    }
    if (size !== resource.byte_length)
      throw new Error("Reader resource length mismatch");
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== resource.sha256)
      throw new Error("Reader resource digest mismatch");
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192)
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    urls[resource.id] = `data:${resource.media_type};base64,${btoa(binary)}`;
  }
  return canonicalPayload({ ...payload, resourceUrls: urls });
}
