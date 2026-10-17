export const REPORT_ROUTE = "/app/admin/pdf-reports";
export const referenceKinds = [
  "conversionId",
  "operationId",
  "failureId",
  "bookId",
  "libraryItemId",
] as const;
export const reportViews = ["snapshot", "events", "cost", "export"] as const;
export type ReportQuery = {
  kind: (typeof referenceKinds)[number];
  reference: string;
  view: (typeof reportViews)[number];
  eventCursor?: string;
  costCursor?: string;
};
export type Search = Record<string, string | string[] | undefined>;
export const validReference = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_.:-]{1,200}$/.test(value) &&
  value !== "." &&
  value !== ".." &&
  !/^(?:sk[-_]|bearer|https?:)/i.test(value);
export const validCursor = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,1024}$/.test(value);

export function parseReportQuery(search: Search): ReportQuery | null {
  if (!Object.keys(search).length) return null;
  const {
    kind,
    reference,
    view = "snapshot",
    eventCursor,
    costCursor,
  } = search;
  if (
    Object.keys(search).some(
      (key) =>
        !["kind", "reference", "view", "eventCursor", "costCursor"].includes(
          key,
        ),
    ) ||
    !referenceKinds.includes(kind as ReportQuery["kind"]) ||
    !validReference(reference) ||
    !reportViews.includes(view as ReportQuery["view"]) ||
    (eventCursor !== undefined && !validCursor(eventCursor)) ||
    (costCursor !== undefined && !validCursor(costCursor)) ||
    (kind !== "conversionId" &&
      (view !== "snapshot" || eventCursor || costCursor))
  ) {
    throw new Error("Invalid report query");
  }
  return { kind, reference, view, eventCursor, costCursor } as ReportQuery;
}

export function reportApiPath(query: ReportQuery) {
  const base = "/api/admin/pdf-conversion-reports";
  if (query.kind !== "conversionId") {
    return `${base}/lookup?${new URLSearchParams({ [query.kind]: query.reference })}`;
  }
  const path = `${base}/${encodeURIComponent(query.reference)}`;
  if (query.view === "snapshot") return path;
  // Legal annotation-rich events can contain thousands of bounded nodes.
  const params = new URLSearchParams({
    limit: query.view === "cost" ? "25" : "4",
  });
  const cursor = query.view === "cost" ? query.costCursor : query.eventCursor;
  if (cursor) params.set("cursor", cursor);
  return `${path}/${query.view}?${params}`;
}

export function reportHref(query: ReportQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value) params.set(key, value);
  return `${REPORT_ROUTE}?${params}`;
}
