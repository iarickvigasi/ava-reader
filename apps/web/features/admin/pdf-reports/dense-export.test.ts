import { expect, it } from "vitest";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { workerObservationPacket } from "../../../../api/src/pdf-conversion/runtime/worker-observation";
import { observationFixture } from "./observation-fixture";
import { coverageFixture } from "./coverage-fixture";
import { parseReportResponse } from "./parse-response";
import { reportApiPath, type ReportQuery } from "./query";

it("preserves a dense export with 16 producers, 20 gaps each and the default 50-call cost page", async () => {
  // Execute the backend fixture under Node, without compiling its BigInt
  // literals as frontend ES2017 source. Neither application's target changes.
  const modulePath = new URL(
    "../../../../api/src/library/pdf-import/reports/cost-projection.ts",
    import.meta.url,
  ).href;
  const { CostProjectionBuilder } = await import(modulePath);
  const query: ReportQuery = {
    kind: "conversionId",
    reference: "pdf-1",
    view: "export",
  };
  const coverage = coverageFixture();
  expect(coverage.producers).toHaveLength(16);
  expect(
    coverage.producers.every((row) => row.missingRanges.length === 20),
  ).toBe(true);
  // Cost breakdown is across the ledger, independently of its 50-call page.
  const cost = new CostProjectionBuilder({ offset: 0, limit: 50 });
  for (let i = 0; i < 500; i++)
    cost.add({
      id: `call-${String(i).padStart(3, "0")}`,
      state: "RELEASED",
      reservedNano: BigInt(0),
      actualNano: null,
      requestSha256: "a".repeat(64),
      receiptSha256: null,
      providerGenerationId: null,
      modelId: `model-${i}`,
      routeProvider: "provider",
      routeId: "route-1",
      tariffSha256: "b".repeat(64),
      configurationSha256: "c".repeat(64),
      purpose: "transcribe_region",
      stage: "RECOGNITION",
      promptTokens: null,
      completionTokens: null,
    });
  const projection = cost.finish(true);
  expect(projection.calls).toHaveLength(50);
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
    investigation: {
      conversionId: "pdf-1",
      status: "FAILED",
      stage: "RECONSTRUCTING",
      coverage: "CAPTURED",
      observationCoverage: coverage,
    },
    timeline: {
      conversionId: "pdf-1",
      watermark: 25,
      events: Array.from({ length: count }, (_, i) => ({
        sequence: i + 1,
        ...event,
      })),
      nextCursor: "events-next",
    },
    cost: { ...projection, conversionId: "pdf-1", nextCursor: "cost-next" },
  });
  expect(() => parseReportResponse(page(5), query)).toThrow();
  const requested = Number(
    new URL(reportApiPath(query), "https://ava.invalid").searchParams.get(
      "limit",
    ),
  );
  expect(requested).toBe(4);
  const parsed = parseReportResponse(page(requested), query);
  expect(parsed.omittedFields).toBe(0);
  expect(parsed.nextCursor).toBe("events-next");
});
