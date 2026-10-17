import { expect, it } from "vitest";
import { recognitionResponse } from "../../../../api/src/pdf-conversion/reconstruction/recognition-response";
import { ResponseValidationError } from "../../../../api/src/pdf-conversion/reconstruction/response-validation-error";
import {
  task,
  response,
} from "../../../../api/src/pdf-conversion/reconstruction/test-fixture";
import { wireSegment } from "../../../../api/src/pdf-conversion/reconstruction/wire-segment-fixture";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";
import { parseReportResponse } from "./parse-response";
import { projectResponse } from "./project-response";

it("preserves an actual host validation finding in the app timeline and downloadable JSON", () => {
  const segment: Record<string, unknown> = {
    ...wireSegment,
    kind: "table",
    text: "PRIVATE_BOOK sk-secret",
  };
  delete segment.cells;
  let failure: unknown;
  try {
    recognitionResponse(
      task,
      JSON.stringify({ ...response, segments: [segment] }),
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ResponseValidationError);
  const finding = (failure as ResponseValidationError).diagnostic()!;
  const event = safeEventSchema.parse({
    kind: "STAGE_ENDED",
    stage: "WORKER_COMMAND",
    details: {
      sourceSha256: task.source_sha256,
      hostResponseValidation: finding,
    },
  });
  const parsed = parseReportResponse(
    {
      schemaVersion: 1,
      conversionId: "pdf-1",
      watermark: 1,
      nextCursor: null,
      events: [
        { sequence: 1, recordedAt: "2026-10-14T17:00:00.000Z", ...event },
      ],
    },
    { kind: "conversionId", reference: "pdf-1", view: "events" },
  );
  expect(parsed.omittedFields).toBe(0);
  expect(JSON.stringify(parsed.value)).toContain('"field":"cells"');
  expect(JSON.stringify(parsed.value)).not.toMatch(/PRIVATE_BOOK|sk-secret/);
  expect(
    JSON.parse(JSON.stringify(parsed.value)).events[0].details
      .hostResponseValidation,
  ).toEqual(finding);
});
it("allows only the exact canonical $defs schema token without allowing general source paths or URLs", () => {
  expect(
    projectResponse({ schemaVersion: 1, schemaPath: ["$defs", "Segment"] })
      .value.schemaPath,
  ).toEqual(["$defs", "Segment"]);
  for (const value of ["/private/source.pdf", "https://private", "$secret"])
    expect(() =>
      projectResponse({ schemaVersion: 1, schemaPath: [value] }),
    ).toThrow();
  expect(() =>
    projectResponse({ schemaVersion: 1, instancePath: ["$defs"] }),
  ).toThrow();
});
