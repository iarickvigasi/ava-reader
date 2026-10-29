import { getPublicApiBaseUrl } from "@/lib/api";

export async function adminRequest<T>(
  path: string,
  getToken: () => Promise<string | null>,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Sign in again to manage the catalog");
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/admin/explore/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(result?.message ?? "Catalog action failed; please retry");
  }
  return (await response.json()) as T;
}
