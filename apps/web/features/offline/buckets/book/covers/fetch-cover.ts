import { getCoverToken } from "./get-cover-token";
import { resolveApiAssetUrl } from "@/lib/api";

export async function fetchCover(
  src: string,
  getToken: () => Promise<string | null> = getCoverToken,
  signal?: AbortSignal,
) {
  const apiOrigin = new URL(resolveApiAssetUrl("/")!).origin;
  const token = new URL(src).origin === apiOrigin ? await getToken?.() : null;
  return fetch(src, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
}
