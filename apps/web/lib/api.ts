export function getPublicApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

export function getServerApiBaseUrl() {
  return process.env.API_BASE_URL ?? getPublicApiBaseUrl();
}
