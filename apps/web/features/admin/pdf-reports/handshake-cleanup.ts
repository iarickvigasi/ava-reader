import { reportReturnTarget } from "./auth-return";
import { REPORT_ROUTE } from "./query";

// Clerk backend's development resolveHandshake removes exactly these keys.
// This only checks its redirect context; Clerk still owns token verification.
export const reportHandshakeKeys = [
  "__clerk_handshake",
  "__clerk_handshake_nonce",
  "__clerk_help",
  "__clerk_db_jwt",
] as const;

export function isReportHandshakeCleanup(
  requestUrl: string,
  location: string | null,
): boolean {
  if (!location) return false;
  try {
    const request = new URL(requestUrl);
    const target = new URL(location, request);
    if (
      request.pathname !== REPORT_ROUTE ||
      target.pathname !== REPORT_ROUTE ||
      target.origin !== request.origin ||
      request.username ||
      request.password ||
      target.username ||
      target.password ||
      request.hash ||
      target.hash ||
      !["__clerk_handshake", "__clerk_handshake_nonce"].some((key) =>
        request.searchParams.get(key),
      )
    )
      return false;
    for (const key of reportHandshakeKeys) {
      if (request.searchParams.getAll(key).length > 1) return false;
      request.searchParams.delete(key);
    }
    const original = reportReturnTarget(request.pathname + request.search);
    return (
      original !== "/app" &&
      original === reportReturnTarget(target.pathname + target.search)
    );
  } catch {
    return false;
  }
}
