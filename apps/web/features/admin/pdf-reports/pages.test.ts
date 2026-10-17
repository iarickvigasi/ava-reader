import { expect, it } from "vitest";
import { parseReportResponse } from "./parse-response";
import type { ReportQuery } from "./query";
const query: ReportQuery = {
  kind: "conversionId",
  reference: "pdf-1",
  view: "export",
};
const summary = {
  conversionId: "pdf-1",
  status: "FAILED",
  stage: "VALIDATION",
  coverage: "CAPTURED",
};
it("binds lookup results and all export sections to the requested identity", () => {
  const lookup = {
    schemaVersion: 1,
    results: [{ ...summary, operationId: "op-1" }],
    complete: true,
  };
  expect(
    parseReportResponse(lookup, {
      ...query,
      kind: "operationId",
      reference: "op-1",
      view: "snapshot",
    }).value.complete,
  ).toBe(true);
  expect(() =>
    parseReportResponse(lookup, {
      ...query,
      kind: "operationId",
      reference: "other",
    }),
  ).toThrow();
  const exportPage = {
    schemaVersion: 1,
    investigation: summary,
    timeline: {
      conversionId: "pdf-1",
      events: [{ sequence: 1 }],
      watermark: 2,
      nextCursor: "next-events",
    },
    cost: {
      conversionId: "pdf-1",
      state: "PROVISIONAL",
      nextCursor: "next-cost",
    },
  };
  expect(parseReportResponse(exportPage, query).nextCursor).toBe("next-events");
  expect(() =>
    parseReportResponse(
      { ...exportPage, cost: { ...exportPage.cost, conversionId: "other" } },
      query,
    ),
  ).toThrow();
});
it("refuses repeated or beyond-watermark events and incomplete snapshots", () => {
  const base = {
    schemaVersion: 1,
    conversionId: "pdf-1",
    watermark: 4,
    nextCursor: null,
  };
  for (const events of [
    [{ sequence: 2 }, { sequence: 2 }],
    [{ sequence: 5 }],
  ]) {
    expect(() =>
      parseReportResponse({ ...base, events }, { ...query, view: "events" }),
    ).toThrow();
  }
  expect(() =>
    parseReportResponse(base, { ...query, view: "snapshot" }),
  ).toThrow();
});
