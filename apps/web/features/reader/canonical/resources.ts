import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { canonicalPayload } from "./payload";
import {
  loadOwnedResource,
  ownedResourceUrl,
  ResourceUnavailableError,
  MAX_RESOURCE_BYTES,
} from "./owned-resource";

export async function loadCanonicalResources(
  payload: ReaderStatusPayload,
  input: { token: string; apiBase: string; signal?: AbortSignal },
): Promise<ReaderStatusPayload> {
  if (payload.status !== "READY" || !payload.readerPackage) return payload;
  const urls: Record<string, string> = {};
  const requests: Record<string, string> = {};
  const failures: string[] = [];
  let total = 0;
  for (const resource of payload.readerPackage.book.resources) {
    total += resource.byte_length;
    if (resource.byte_length > MAX_RESOURCE_BYTES || total > MAX_RESOURCE_BYTES)
      throw new Error("Reader resource limit");
    requests[resource.id] = ownedResourceUrl(
      payload.resourceUrls?.[resource.id] ?? "",
      input.apiBase,
    );
  }
  for (const resource of payload.readerPackage.book.resources) {
    try {
      urls[resource.id] = await loadOwnedResource(
        resource,
        requests[resource.id],
        input,
      );
    } catch (error) {
      if (!(error instanceof ResourceUnavailableError)) throw error;
      urls[resource.id] = "";
      failures.push(resource.id);
    }
  }
  input.signal?.throwIfAborted();
  return canonicalPayload({
    ...payload,
    resourceUrls: urls,
    resourceRequests: requests,
    resourceFailures: failures,
  });
}
