import { getPublicApiBaseUrl } from "@/lib/api";
export function ownedCoverItemId(src: string | null): string | null {
  if (!src) return null;
  try {
    const base = new URL(getPublicApiBaseUrl());
    const url = new URL(src, base);
    const match = /^\/api\/library\/epub-imports\/covers\/([^/]+)$/.exec(
      url.pathname,
    );
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !match
    )
      return null;
    const id = decodeURIComponent(match[1]);
    return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
