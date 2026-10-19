import { expect, it } from "vitest";
import { workerObservationPacket } from "../../../../api/src/pdf-conversion/runtime/worker-observation";
import { measurementPacket } from "../../../../api/src/library/pdf-import/reports/worker-measurements-fixture";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { parseReportResponse } from "./parse-response";

it.each(["non_heading_ancestry", "body_reference_size_baseline"])(
  "retains the finite guard check %s and node provenance through the actual report projection",
  (check) => {
    const packet = workerObservationPacket.parse({
      ...structuredClone(measurementPacket),
      findings_complete: true,
      findings: [
        {
          kind: "refinement",
          code: "REFINEMENT_ROLE_BASELINE_INVALID",
          stage: "refinement",
          check,
          task_id_sha256: "1".repeat(64),
          node_id_sha256: "2".repeat(64),
          observation_sha256: "3".repeat(64),
          render_sha256: "4".repeat(64),
          page: 43,
        },
      ],
    });
    const event = safeEventSchema.parse({
      kind: "STAGE_ENDED",
      stage: "WORKER_COMMAND",
      details: { workerObservation: { status: "OBSERVED", packet } },
    });
    const response = {
      schemaVersion: 1,
      conversionId: "pdf-1",
      watermark: 1,
      nextCursor: null,
      events: [
        { sequence: 1, recordedAt: "2026-10-19T07:00:00.000Z", ...event },
      ],
    };
    const query = {
      kind: "conversionId",
      reference: "pdf-1",
      view: "events",
    } as const;
    const parsed = parseReportResponse(response, query);
    expect(parsed.omittedFields).toBe(0);
    expect(
      JSON.parse(JSON.stringify(parsed.value)).events[0].details
        .workerObservation.packet,
    ).toEqual(packet);
    const unsafe = structuredClone(response);
    Object.assign(unsafe.events[0].details!.workerObservation!, {
      messages: ["PRIVATE_BOOK sk-secret"],
      rawResponse: "PRIVATE_BOOK sk-secret",
    });
    if (unsafe.events[0].details!.workerObservation!.status !== "OBSERVED")
      throw Error("fixture");
    Object.assign(
      unsafe.events[0].details!.workerObservation!.packet.findings[0],
      {
        text_excerpt: "PRIVATE_BOOK sk-secret",
        relative_size: 0.95,
        node_id: "PRIVATE_BOOK sk-secret",
      },
    );
    const projected = parseReportResponse(unsafe, query);
    expect(projected.omittedFields).toBe(5);
    expect(projected.value).toEqual(parsed.value);
    expect(JSON.stringify(projected.value)).not.toMatch(
      /PRIVATE_BOOK|sk-secret|text_excerpt|relative_size/,
    );
  },
);
