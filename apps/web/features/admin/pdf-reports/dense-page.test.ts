import { expect, it } from "vitest";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { workerObservationPacket } from "../../../../api/src/pdf-conversion/runtime/worker-observation";
import { observationFixture } from "./observation-fixture";
import { parseReportResponse } from "./parse-response";
import { reportApiPath, type ReportQuery } from "./query";

it("requests a bounded page that preserves dense, production-schema-valid annotation events", () => {
  const query: ReportQuery = {
    kind: "conversionId",
    reference: "pdf-1",
    view: "events",
  };
  const event = safeEventSchema.parse({
    kind: "STAGE_ENDED",
    stage: "RECONSTRUCTING",
    details: {
      workerObservation: {
        status: "OBSERVED",
        packet: workerObservationPacket.parse(observationFixture),
      },
      pageIndices: Array.from({ length: 512 }, (_, i) => i),
      locations: Array.from({ length: 100 }, (_, i) => ({
        pageNumber: i + 1,
        regionId: "r".repeat(200),
        annotationNumber: i + 1,
        relationshipPath: Array.from({ length: 20 }, () => "/Parent"),
      })),
    },
  });
  const page = (count: number) => ({
    schemaVersion: 1,
    conversionId: "pdf-1",
    watermark: 25,
    events: Array.from({ length: count }, (_, i) => ({
      sequence: i + 1,
      ...event,
    })),
    nextCursor: "continue",
  });
  // Retains the original failure: legal 25-event pages exceed viewer bounds.
  expect(() => parseReportResponse(page(25), query)).toThrow();
  const requested = Number(
    new URL(reportApiPath(query), "https://ava.invalid").searchParams.get(
      "limit",
    ),
  );
  expect(requested).toBe(4);
  expect(parseReportResponse(page(requested), query).omittedFields).toBe(0);
  expect(reportApiPath({ ...query, view: "export" })).toContain("limit=4");
  expect(reportApiPath({ ...query, view: "cost" })).toContain("limit=25");
});
