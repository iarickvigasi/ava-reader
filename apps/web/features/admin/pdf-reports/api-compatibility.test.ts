import { expect, it } from "vitest";
import { workerObservationPacket } from "../../../../api/src/pdf-conversion/runtime/worker-observation";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { observationFixture } from "./observation-fixture";
import { parseReportResponse } from "./parse-response";

it("preserves a production-schema-validated packet, scope, timestamps, annotation paths and decimal boxes", () => {
  const packet = workerObservationPacket.parse(observationFixture);
  const event = safeEventSchema.parse({
    kind: "STAGE_ENDED",
    stage: "RECONSTRUCTING",
    details: {
      workerObservation: { status: "OBSERVED", packet },
      locations: [
        {
          pageNumber: 1,
          annotationNumber: 1,
          relationshipPath: ["/Popup", "/Parent", "/IRT"],
        },
      ],
      sourceFindings: {
        stage: "assembly",
        complete: true,
        findings: [
          {
            kind: "source",
            severity: "blocking",
            code: "RECOGNITION_UNRESOLVED",
            page: 1,
            block_id: "block-1",
            segment_id_sha256: "a".repeat(64),
            task_id: null,
            render_sha256: null,
            region_box: {
              coordinate_space: "page_points_top_left",
              x0: 0,
              y0: 0,
              x1: 20,
              y1: 20,
            },
            box: {
              coordinate_space: "page_points_top_left",
              x0: 1.25,
              y0: 2.75,
              x1: 10.5,
              y1: 11.5,
            },
          },
        ],
      },
    },
  });
  const parsed = parseReportResponse(
    {
      schemaVersion: 1,
      conversionId: "pdf-1",
      watermark: 1,
      events: [
        { sequence: 1, recordedAt: "2026-10-09T10:00:00.025Z", ...event },
      ],
      nextCursor: null,
    },
    { kind: "conversionId", reference: "pdf-1", view: "events" },
  );
  expect(parsed.omittedFields).toBe(0);
  expect(parsed.value.events).toEqual([
    { sequence: 1, recordedAt: "2026-10-09T10:00:00.025Z", ...event },
  ]);
});

it("preserves bounded worker measurement availability with its scope limits and keeps capture/delivery/fidelity distinct", () => {
  const summary = {
    scope: "BOUND_RECORDED_WORKER_COMMANDS_AT_WATERMARK",
    packetCount: 1,
    rejectedPacketCount: 0,
    missingPacketCount: 0,
    scanComplete: true,
    workDurations: "AVAILABLE",
    checkpointReuse: "AVAILABLE",
    resources: "AVAILABLE",
    inventory: "AVAILABLE",
    sourceFidelity: "NOT_ESTABLISHED",
    failureCode: "RECONSTRUCTION_REVIEW_REQUIRED",
    limitations: [
      "RSS_WORKER_LIFETIME_MAX_NOT_CONTAINER_PEAK",
      "LANGUAGE_HEURISTIC_LAYOUT_MAY_BE_UNKNOWN",
    ],
  };
  const parsed = parseReportResponse(
    {
      schemaVersion: 1,
      conversionId: "pdf-1",
      status: "FAILED",
      stage: "RECONSTRUCTION",
      coverage: "API_LIFECYCLE",
      evidenceGaps: ["RESOURCES_OUTSIDE_RECORDED_WORKER_PROCESS"],
      workerMeasurements: summary,
      observationCoverage: { state: "RECORDED", complete: true },
    },
    { kind: "conversionId", reference: "pdf-1", view: "snapshot" },
  );
  expect(parsed.omittedFields).toBe(0);
  expect(parsed.value.workerMeasurements).toEqual(summary);
  expect(parsed.value.coverage).toBe("API_LIFECYCLE");
  expect(parsed.value.status).toBe("FAILED");
});
