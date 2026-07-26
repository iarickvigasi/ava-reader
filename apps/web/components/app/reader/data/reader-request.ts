import { getPublicApiBaseUrl } from "@/lib/api";

// HTTP constants shared across reader endpoints.
export const HTTP_METHOD_POST = "POST";
export const HTTP_METHOD_PATCH = "PATCH";
export const HTTP_HEADER_CONTENT_TYPE = "Content-Type";
export const HTTP_CONTENT_TYPE_APPLICATION_JSON = "application/json";

// Builds the absolute URL for a reader endpoint scoped to a single library item.
// Pass an empty path for the root `/reader` endpoint.
export function buildReaderUrl(libraryItemId: string, path = ""): URL {
  const suffix = path ? `/${path}` : "";
  return new URL(
    `${getPublicApiBaseUrl()}/api/library/${libraryItemId}/reader${suffix}`,
  );
}

// Standard JSON content-type header used by mutating reader requests.
export function jsonContentTypeHeader() {
  return {
    [HTTP_HEADER_CONTENT_TYPE]: HTTP_CONTENT_TYPE_APPLICATION_JSON,
  } as const;
}

// Adds the bearer Authorization header to an existing header bag.
export function withAuthHeader(
  token: string,
  headers: HeadersInit = {},
): HeadersInit {
  return {
    ...(headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
}
