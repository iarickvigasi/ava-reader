import type { ReportObject } from "./types";

export function validateSnapshot(value: ReportObject) {
  for (const field of ["status", "stage", "coverage"])
    if (typeof value[field] !== "string" || !value[field])
      throw new Error("Invalid investigation summary");
}

export function validateTimeline(value: ReportObject) {
  if (
    !Array.isArray(value.events) ||
    value.events.length > 100 ||
    !Number.isSafeInteger(value.watermark)
  )
    throw new Error("Invalid event page");
  let previous = 0;
  for (const event of value.events) {
    if (
      !event ||
      typeof event !== "object" ||
      Array.isArray(event) ||
      !Number.isSafeInteger(event.sequence) ||
      (event.sequence as number) <= previous ||
      (event.sequence as number) > (value.watermark as number)
    )
      throw new Error("Invalid event order");
    previous = event.sequence as number;
  }
}

export function validateCost(value: ReportObject) {
  if (
    !["FINAL", "PROVISIONAL", "MISSING", "INCOMPLETE", "STALE"].includes(
      String(value.state),
    ) ||
    (value.actualComplete !== undefined &&
      typeof value.actualComplete !== "boolean")
  )
    throw new Error("Invalid cost state");
  if (
    value.actualComplete === true &&
    (value.state !== "FINAL" ||
      typeof value.knownActualNano !== "string" ||
      value.reservedNano !== "0" ||
      value.uncertainNano !== "0")
  )
    throw new Error("Invalid final cost");
}
