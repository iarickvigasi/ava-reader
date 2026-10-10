import type { LoadedReport } from "./load-report";
import type { Search } from "./query";

// Each read belongs to one live account/query generation. Cancellation fences
// late bodies even when the transport ignores AbortSignal.
export function beginReportRead(
  search: Search,
  ownerId: string,
  deliver: (result: LoadedReport) => void,
  request: typeof fetch = fetch,
) {
  let active = true;
  const abort = new AbortController(),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(search))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  const timer = setTimeout(() => {
    if (active) deliver({ state: "unavailable" });
    active = false;
    abort.abort();
  }, 12_000);
  void request(`/api/admin/pdf-reports?${params}`, {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "application/json" },
    signal: abort.signal,
  })
    .then(async (response) => {
      if (![200, 401, 403].includes(response.status))
        throw new Error("Report unavailable");
      const result = (await response.json()) as LoadedReport;
      if (!active || abort.signal.aborted) return;
      if (result.ownerId && result.ownerId !== ownerId)
        deliver({ state: "accessChanged" });
      else if (result.state === "ready" && result.ownerId !== ownerId)
        deliver({ state: "invalid" });
      else deliver(result);
    })
    .catch(() => {
      if (active) deliver({ state: "unavailable" });
    })
    .finally(() => clearTimeout(timer));
  return () => {
    active = false;
    abort.abort();
    clearTimeout(timer);
  };
}
