import { expect, it } from "vitest";
import { parseReportResponse } from "./parse-response";
import { formatUsdNano } from "./format-cost";
import type { ReportQuery } from "./query";
const query: ReportQuery = {
  kind: "conversionId",
  reference: "pdf-1",
  view: "cost",
};
it("preserves precise money and missing projections without inventing zero", () => {
  const amount = "9007199254740993001";
  const parsed = parseReportResponse(
    {
      schemaVersion: 1,
      conversionId: "pdf-1",
      state: "FINAL",
      knownActualNano: amount,
      uncertainNano: "0",
      nextCursor: null,
    },
    query,
  );
  expect(parsed.value.knownActualNano).toBe(amount);
  expect(formatUsdNano(amount)).toBe("$9007199254.740993001 USD");
  expect(formatUsdNano("1")).toBe("$0.000000001 USD");
  expect(formatUsdNano(null)).toBe("Unknown");
  expect(
    parseReportResponse(
      { schemaVersion: 1, conversionId: "pdf-1", state: "MISSING" },
      query,
    ).value.knownActualNano,
  ).toBeUndefined();
  expect(() =>
    parseReportResponse(
      {
        schemaVersion: 1,
        conversionId: "pdf-1",
        state: "FINAL",
        knownActualNano: 1,
      },
      query,
    ),
  ).toThrow();
});
it("projects only safe fields, detects changed identities and rejects unsafe retained values", () => {
  const base = {
    schemaVersion: 1,
    conversionId: "pdf-1",
    state: "STALE",
    rawProviderPayload: "private canary",
    nextCursor: null,
  };
  const parsed = parseReportResponse(base, query);
  expect(JSON.stringify(parsed)).not.toContain("private canary");
  expect(parsed.omittedFields).toBe(1);
  expect(() =>
    parseReportResponse({ ...base, conversionId: "other" }, query),
  ).toThrow();
  expect(() =>
    parseReportResponse(
      { ...base, sourceSha256: "/private/source.pdf" },
      query,
    ),
  ).toThrow();
  expect(() =>
    parseReportResponse({ ...base, nextCursor: "https://private" }, query),
  ).toThrow();
});
it("rejects a final-cost claim while an uncertain charge is held", () => {
  expect(() =>
    parseReportResponse(
      {
        schemaVersion: 1,
        conversionId: "pdf-1",
        state: "FINAL",
        actualComplete: true,
        knownActualNano: "1",
        reservedNano: "0",
        uncertainNano: "1",
      },
      query,
    ),
  ).toThrow();
});
