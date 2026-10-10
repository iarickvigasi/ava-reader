import { validCursor, validReference, type ReportQuery } from "./query";
import { projectResponse } from "./project-response";
import type { ReportData, ReportObject, ReportValue } from "./types";
import {
  validateCost,
  validateSnapshot,
  validateTimeline,
} from "./validate-page";

export function object(value: ReportValue | undefined): ReportObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid report shape");
  return value;
}
export function parseReportResponse(
  input: unknown,
  query: ReportQuery,
): ReportData {
  const projected = projectResponse(input),
    value = projected.value;
  const cursor = (row: ReportObject) => {
    if (row.nextCursor !== null && !validCursor(row.nextCursor))
      throw new Error("Invalid report cursor");
    return row.nextCursor as string | null;
  };
  const bound = (row: ReportObject) => {
    if (row.conversionId !== query.reference)
      throw new Error("Report identity mismatch");
  };
  let nextCursor: string | null = null;
  if (query.kind !== "conversionId") {
    if (
      !Array.isArray(value.results) ||
      value.results.length > 20 ||
      typeof value.complete !== "boolean"
    )
      throw new Error("Invalid lookup response");
    for (const item of value.results) {
      const row = object(item);
      validateSnapshot(row);
      if (
        !validReference(row.conversionId) ||
        row[query.kind] !== query.reference
      )
        throw new Error("Lookup identity mismatch");
    }
  } else if (query.view === "export") {
    bound(object(value.investigation));
    bound(object(value.timeline));
    bound(object(value.cost));
    validateSnapshot(object(value.investigation));
    validateTimeline(object(value.timeline));
    validateCost(object(value.cost));
    nextCursor = cursor(object(value.timeline));
  } else {
    bound(value);
    if (query.view === "snapshot") validateSnapshot(value);
    if (query.view === "events") {
      validateTimeline(value);
      nextCursor = cursor(value);
    }
    if (query.view === "cost") {
      validateCost(value);
      if (value.nextCursor !== undefined) nextCursor = cursor(value);
    }
  }
  return { ...projected, nextCursor };
}
