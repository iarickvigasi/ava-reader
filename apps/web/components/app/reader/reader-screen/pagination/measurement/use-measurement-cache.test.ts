import { describe, expect, it } from "vitest";
import {
  createFailedReaderMeasurementEntry,
  createPendingReaderMeasurementEntry,
} from "@/features/reader/measurement";
import { createReadyMeasurementEntry } from "./measurement-test-fixture";
import { selectMeasurementEntryToStore } from "./use-measurement-cache";

const layoutKey = "layout:chapter-a";

describe("selectMeasurementEntryToStore", () => {
  it("does not replace a ready entry with a transient pending or failed entry", () => {
    const current = createReadyMeasurementEntry();

    expect(
      selectMeasurementEntryToStore(
        current,
        createPendingReaderMeasurementEntry({
          chapterId: "chapter-a",
          layoutKey,
        }),
      ),
    ).toBe(current);
    expect(
      selectMeasurementEntryToStore(
        current,
        createFailedReaderMeasurementEntry({
          chapterId: "chapter-a",
          layoutKey,
        }),
      ),
    ).toBe(current);
  });

  it("does not collapse a known multi-page layout to one page", () => {
    const current = createReadyMeasurementEntry({ pageCount: 8 });
    const collapsed = createReadyMeasurementEntry({ pageCount: 1 });

    expect(selectMeasurementEntryToStore(current, collapsed)).toBe(current);
  });

  it("accepts a new ready multi-page measurement", () => {
    const current = createReadyMeasurementEntry({ pageCount: 8 });
    const updated = createReadyMeasurementEntry({ pageCount: 9 });

    expect(selectMeasurementEntryToStore(current, updated)).toBe(updated);
  });
});
