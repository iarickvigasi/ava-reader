export async function fetchCatalog<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const base =
    process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL ?? "http://localhost:4001";
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 10_000);
  try {
    const response = await fetch(`${base}/api/${path}`, {
      signal: controller.signal,
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error(`Catalog request failed (${response.status})`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
