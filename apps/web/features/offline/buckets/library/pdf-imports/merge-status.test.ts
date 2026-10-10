import { describe, expect, it } from "vitest";
import { mergePdfImportStatus } from "./merge-status";
import { readPdfImportStatus } from "./read-status";
import { pdfStatus as status } from "./test-fixture";

describe("PDF status authority", () => {
  it("retains status when older payloads omit it, reorder generations or change import identity", () => {
    for (const stale of [
      undefined,
      null,
      { ...status, generation: 1 },
      { ...status, updatedAt: "2026-09-28T10:00:00Z" },
      { ...status, operationId: "other" },
    ])
      expect(mergePdfImportStatus(status, stale)).toBe(status);
  });
  it("never regresses a terminal result or replaces finished content", () => {
    const ready = {
      ...status,
      status: "READY" as const,
      finalContentId: "fixed",
    };
    expect(mergePdfImportStatus(ready, { ...status, generation: 3 })).toBe(
      ready,
    );
    expect(
      mergePdfImportStatus(ready, { ...ready, finalContentId: "replacement" }),
    ).toBe(ready);
    const failed = {
      ...status,
      status: "FAILED" as const,
      failureId: "failure",
    };
    expect(mergePdfImportStatus(failed, ready)).toBe(failed);
  });
  it("accepts a later measured stage and rejects malformed Ready or invented progress", () => {
    const next = {
      ...status,
      generation: 3,
      progress: { completed: 8, total: 8 },
    };
    expect(mergePdfImportStatus(status, next)).toBe(next);
    expect(readPdfImportStatus({ ...status, status: "READY" })).toBeNull();
    expect(
      readPdfImportStatus({ ...status, progress: { completed: 9, total: 8 } }),
    ).toBeNull();
    expect(
      readPdfImportStatus({ ...status, updatedAt: "nonsense" }),
    ).toBeNull();
  });
});
