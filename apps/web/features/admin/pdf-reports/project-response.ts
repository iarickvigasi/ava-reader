import { safeFields } from "./safe-fields";
import type { ReportObject, ReportValue } from "./types";

export function projectResponse(input: unknown) {
  let omittedFields = 0,
    nodes = 0;
  function visit(value: unknown, depth = 0, key = ""): ReportValue {
    if (++nodes > 20_000 || depth > 16)
      throw new Error("Invalid report response");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      return value;
    if (typeof value === "string") {
      if (
        value.length > 1024 ||
        !/^[A-Za-z0-9_.:/+\-]*$/.test(value) ||
        /^(?:sk[-_]|bearer|https?:|file:)/i.test(value) ||
        (value.startsWith("/") &&
          !["/Popup", "/Parent", "/IRT"].includes(value)) ||
        (key.endsWith("Nano") && !/^(0|[1-9][0-9]{0,39})$/.test(value))
      ) {
        throw new Error("Invalid report response");
      }
      return value;
    }
    if (Array.isArray(value))
      return value.map((item) => visit(item, depth + 1, key));
    if (value && typeof value === "object") {
      const result: ReportObject = {};
      for (const [field, entry] of Object.entries(value)) {
        if (!safeFields.has(field)) {
          omittedFields++;
          continue;
        }
        if (
          field.endsWith("Nano") &&
          entry !== null &&
          typeof entry !== "string"
        )
          throw new Error("Invalid report amount");
        result[field] = visit(entry, depth + 1, field);
      }
      return result;
    }
    throw new Error("Invalid report response");
  }
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 512 * 1024)
    throw new Error("Invalid report size");
  const value = visit(input);
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    value.schemaVersion !== 1
  )
    throw new Error("Invalid report response");
  return { value, omittedFields };
}
