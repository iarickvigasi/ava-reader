import { expect, it } from "vitest";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import { createRestoreIntent } from "@/features/reader/navigation";
import { restoreSucceeded } from "./restore-succeeded";

const ready: Extract<ReaderMeasurementEntry, { status: "ready" }> = {
  status: "ready",
  chapterId: "chapter",
  layoutKey: "layout",
  pageCount: 1,
  resolveLocator: () => null,
  resolvePageIndex: () => ({ status: "exact", pageIndex: 0, column: 1 }),
};
it("acknowledges exact measured text and nontext block start only", () => {
  const text = createRestoreIntent(
    "chapter",
    { blockId: "body", textOffset: 3, requestId: 9 },
    "jump",
  );
  expect(restoreSucceeded(text, ready)).toBe(true);
  const fallback = {
    ...ready,
    resolvePageIndex: () => ({
      status: "block-start" as const,
      pageIndex: 0,
      column: 1 as const,
    }),
  };
  expect(restoreSucceeded(text, fallback)).toBe(false);
  expect(
    restoreSucceeded(
      createRestoreIntent(
        "chapter",
        { blockId: "figure", textOffset: 0 },
        "figure",
      ),
      fallback,
    ),
  ).toBe(true);
});
it("does not commit missing targets or pending/failed measurements", () => {
  const intent = createRestoreIntent("chapter", { blockId: "missing" }, "jump");
  expect(
    restoreSucceeded(intent, {
      ...ready,
      resolvePageIndex: () => ({ status: "missing-block" }),
    }),
  ).toBe(false);
  for (const status of ["pending", "failed"] as const)
    expect(restoreSucceeded(intent, { ...ready, status })).toBe(false);
});
