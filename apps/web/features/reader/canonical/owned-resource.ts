import { READER_CAPABILITY_HEADERS } from "./headers";
import type { ImageResource } from "@/lib/api-types/canonical-reader.generated";

export const MAX_RESOURCE_BYTES = 200 * 1024 * 1024;

export class ResourceUnavailableError extends Error {
  constructor() {
    super("Reader resource unavailable");
  }
}

export function ownedResourceUrl(value: string, apiBase: string): string {
  const url = new URL(value, apiBase),
    base = new URL(apiBase);
  if (
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    !/^(?:\/api)?\/library\/(?:pdf-imports\/[^/]+\/(?:artifacts|resources)|epub-imports\/[^/]+\/resources)\/[^/]+$/.test(
      url.pathname,
    )
  )
    throw new Error("Invalid owned resource URL");
  return url.toString();
}

export async function loadOwnedResource(
  resource: ImageResource,
  url: string,
  input: { token: string; apiBase: string; signal?: AbortSignal },
): Promise<string> {
  if (
    !Number.isSafeInteger(resource.byte_length) ||
    resource.byte_length < 1 ||
    resource.byte_length > MAX_RESOURCE_BYTES
  )
    throw new Error("Reader resource limit");
  const ownedUrl = ownedResourceUrl(url, input.apiBase);
  input.signal?.throwIfAborted();
  let response: Response;
  try {
    response = await fetch(ownedUrl, {
      headers: {
        Authorization: `Bearer ${input.token}`,
        ...READER_CAPABILITY_HEADERS,
      },
      signal: input.signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    input.signal?.throwIfAborted();
    if (error instanceof TypeError) throw new ResourceUnavailableError();
    throw error;
  }
  if (!response.ok || !response.body) throw new ResourceUnavailableError();
  const chunks: Uint8Array[] = [],
    reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      input.signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > resource.byte_length) {
        await reader.cancel();
        throw new Error("Reader resource length mismatch");
      }
      chunks.push(value);
    }
  } catch (error) {
    input.signal?.throwIfAborted();
    if (error instanceof TypeError) throw new ResourceUnavailableError();
    throw error;
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
  input.signal?.throwIfAborted();
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return `data:${resource.media_type};base64,${btoa(binary)}`;
}
