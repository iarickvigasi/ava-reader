import { projectObservationCoverage } from "../../../../api/src/library/pdf-import/reports/observation-coverage";
import { safeEventSchema } from "../../../../api/src/library/pdf-import/reports/event-contract";

export function coverageFixture() {
  const rows: { sequence: number; event: unknown }[] = [];
  const scope = "COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY";
  for (let i = 0; i < 16; i++) {
    const producerId = `attempt-${i}`;
    const binding = {
      jobId: "job-1",
      sourceSha256: "a".repeat(64),
      configSha256: "b".repeat(64),
      profileId: "ava-pdf-prose-en-v2",
      workerFingerprint: "c".repeat(64),
    };
    const add = (kind: string, details: object) =>
      rows.push({
        sequence: rows.length + 1,
        event: safeEventSchema.parse({
          kind,
          stage: "RECONSTRUCTING",
          attemptId: producerId,
          attemptFence: 1,
          generation: 1,
          cancellationEpoch: 0,
          details: { ...binding, ...details },
        }),
      });
    add("CLAIMED", { observationProtocol: { version: 1, producerId, scope } });
    for (let ordinal = 2; ordinal <= 40; ordinal += 2)
      add("PROGRESS", { observationDelivery: { producerId, ordinal } });
    add("VALIDATION", {
      observationWatermark: {
        version: 1,
        producerId,
        throughOrdinal: 40,
        reportedFailures: 20,
        sealed: true,
        scope,
      },
    });
  }
  return projectObservationCoverage(rows, rows.length);
}
