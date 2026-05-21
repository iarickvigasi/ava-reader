export function getPublicApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

export function getServerApiBaseUrl() {
  return process.env.API_BASE_URL ?? getPublicApiBaseUrl();
}

// API responses return relative paths like `/library/covers/abc`. The browser
// loads those via <img>, so we need to point them at the API origin rather
// than the Next.js origin. Returns null passthrough so callers can keep their
// existing null-check.
export function resolveApiAssetUrl(path: null | string) {
  if (!path) {
    return path;
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${getPublicApiBaseUrl()}${path}`;
}
