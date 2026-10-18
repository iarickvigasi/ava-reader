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

it.each(["PROVED", "NO_PROOF"] as const)(
  "preserves content-free local OCR %s evidence in report projections",
  (status) => {
    const local = {
      origin: "LOCAL_OCR",
      method: "ava-cell-exact-line-ocr-1",
      taskId: "recognition-cell-geometry-" + "a".repeat(64),
      requestSha256: "b".repeat(64),
      languages: "eng+ukr",
      renderSha256: "c".repeat(64),
      originalResponseSha256: "d".repeat(64),
      proofSha256: "e".repeat(64),
      tsvSha256: "f".repeat(64),
      responseSha256: status === "PROVED" ? "a".repeat(64) : null,
      binarySha256: "b".repeat(64),
      traineddataSha256: ["c".repeat(64), "d".repeat(64)],
      status,
      reason: status === "PROVED" ? null : "NO_UNIQUE_SOURCE_LINE",
      slotCount: 1,
      providerCalls: 0,
      providerCostNano: "0",
    };
    const event = safeEventSchema.parse({
      kind: "VALIDATION",
      stage: "LOCAL_CELL_GEOMETRY",
      details: { localCellGeometry: local },
    });
    const response = {
      schemaVersion: 1,
      conversionId: "pdf-1",
      watermark: 1,
      events: [
        { sequence: 1, recordedAt: "2026-10-18T12:00:00.000Z", ...event },
      ],
      nextCursor: null,
    };
    const query = {
      kind: "conversionId",
      reference: "pdf-1",
      view: "events",
    } as const;
    const parsed = parseReportResponse(response, query);
    expect(parsed.omittedFields).toBe(0);
    expect(parsed.value.events).toEqual(response.events);
    const unsafe = structuredClone(response);
    Object.assign(unsafe.events[0].details!.localCellGeometry!, {
      tsv_base64: "private OCR canary",
      response_json: "private response canary",
    });
    const projected = parseReportResponse(unsafe, query);
    expect(projected.omittedFields).toBe(2);
    expect(JSON.stringify(projected.value)).not.toContain("private");
    expect(projected.value.events).toEqual(response.events);
  },
);

it("preserves content-free verified locator projections while omitting raw content", () => {
  const projection = {
    method: "ava-anchor-context-bounds-1",
    rawResponseSha256: "a".repeat(64),
    derivedResponseSha256: "b".repeat(64),
    originalResponseSha256: "c".repeat(64),
    slots: [
      {
        segmentIndex: 2,
        spanIndex: 1,
        codePointStart: 33,
        originalBefore: 33,
        originalAfter: 229,
        finalBefore: 33,
        finalAfter: 128,
      },
    ],
  };
  const event = safeEventSchema.parse({
    kind: "VALIDATION",
    stage: "ANCHOR_CONTEXT_PROJECTION",
    details: { anchorContextProjection: projection },
  });
  const response = {
    schemaVersion: 1,
    conversionId: "pdf-1",
    watermark: 1,
    events: [{ sequence: 1, recordedAt: "2026-10-18T14:00:00.000Z", ...event }],
    nextCursor: null,
  };
  const query = {
    kind: "conversionId",
    reference: "pdf-1",
    view: "events",
  } as const;
  expect(parseReportResponse(response, query)).toMatchObject({
    omittedFields: 0,
    value: { events: response.events },
  });
  Object.assign(response.events[0].details.anchorContextProjection!, {
    rawResponse: "private source canary",
  });
  const parsed = parseReportResponse(response, query);
  expect(parsed.omittedFields).toBe(1);
  expect(JSON.stringify(parsed.value)).not.toContain("private source");
});
