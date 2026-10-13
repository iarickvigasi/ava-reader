import {
  parseReportQuery,
  REPORT_ROUTE,
  reportHref,
  type Search,
} from "./query";

// Only this validated internal report location may replace the ordinary /app return.
export function reportReturnTarget(value: unknown): string {
  if (
    typeof value !== "string" ||
    (value !== REPORT_ROUTE && !value.startsWith(`${REPORT_ROUTE}?`))
  )
    return "/app";
  try {
    const url = new URL(value, "https://ava.invalid");
    if (url.pathname !== REPORT_ROUTE || url.hash) return "/app";
    const search: Search = Object.create(null);
    for (const [key, item] of url.searchParams) {
      if (Object.hasOwn(search, key)) return "/app";
      search[key] = item;
    }
    const query = parseReportQuery(search);
    return query ? reportHref(query) : REPORT_ROUTE;
  } catch {
    return "/app";
  }
}
