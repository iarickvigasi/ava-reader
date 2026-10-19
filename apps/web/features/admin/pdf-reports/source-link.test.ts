import { expect, it } from "vitest";
import { workerObservationPacket } from "../../../../api/src/pdf-conversion/runtime/worker-observation";
import { measurementPacket } from "../../../../api/src/library/pdf-import/reports/worker-measurements-fixture";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { parseReportResponse } from "./parse-response";

it("preserves all bounded original source-link failure provenance in the timeline and exported JSON", () => {
  const packet = workerObservationPacket.parse({
    ...structuredClone(measurementPacket),
    failure_code: "RECONSTRUCTION_REVIEW_REQUIRED",
    findings_complete: true,
    findings: [
      {
        kind: "source_link",
        code: "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW",
        link_step: "caller",
        page: 231,
        annotation_number: 28,
        observation_sha256: "5".repeat(64),
        render_sha256: "6".repeat(64),
      },
    ],
  });
  const event = safeEventSchema.parse({
    kind: "STAGE_ENDED",
    stage: "WORKER_COMMAND",
    details: { workerObservation: { status: "OBSERVED", packet } },
  });
  const parsed = parseReportResponse(
    {
      schemaVersion: 1,
      conversionId: "pdf-1",
      watermark: 1,
      nextCursor: null,
      events: [
        { sequence: 1, recordedAt: "2026-10-18T09:00:00.000Z", ...event },
      ],
    },
    { kind: "conversionId", reference: "pdf-1", view: "events" },
  );
  expect(parsed.omittedFields).toBe(0);
  expect(
    JSON.parse(JSON.stringify(parsed.value)).events[0].details.workerObservation
      .packet,
  ).toEqual(packet);
  expect(JSON.stringify(parsed.value)).not.toMatch(
    /text_excerpt|base64|PRIVATE_BOOK|sk-secret/,
  );
});
