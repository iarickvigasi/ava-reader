import { expect, it } from "vitest";
import { workerObservationPacket } from "../../../../api/src/pdf-conversion/runtime/worker-observation";
import { measurementPacket } from "../../../../api/src/library/pdf-import/reports/worker-measurements-fixture";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { parseReportResponse } from "./parse-response";

it("preserves all bounded join-conflict provenance in the timeline and exported JSON", () => {
  const packet = workerObservationPacket.parse({
    ...structuredClone(measurementPacket),
    failure_code: "RECONSTRUCTION_REVIEW_REQUIRED",
    findings_complete: true,
    findings: [
      {
        kind: "refinement",
        code: "JOIN_TYPOGRAPHY_CONFLICT",
        stage: "refinement",
        task_id_sha256: "1".repeat(64),
        edge_id_sha256: "2".repeat(64),
        previous_id_sha256: "3".repeat(64),
        next_id_sha256: "4".repeat(64),
        observation_sha256: "5".repeat(64),
        render_sha256: "6".repeat(64),
        previous_page: 43,
        next_page: 44,
        conflicting_fields: ["italic", "line_height"],
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
