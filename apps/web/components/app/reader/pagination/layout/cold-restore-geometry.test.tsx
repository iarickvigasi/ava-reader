import { expect, it, vi } from "vitest";
import {
  createInitialTraversalState,
  createRestoreIntent,
} from "@/features/reader/navigation";
import { attr, nodes, text } from "../measurement/measurement-markup-fixture";
import { parseFragment } from "parse5";
import { coldPayload } from "./cold-restore-test-fixture";
import { renderColdRestore } from "./cold-restore-test-probe";
const box = vi.hoisted(() => ({ width: 1088 }));
vi.mock("../use-viewport-size", () => ({
  useViewportSize: () => ({
    availableHeight: 419,
    pageBoxRef: { current: null },
    rootRef: { current: null },
    pageBoxSize: { width: box.width, height: 419 },
  }),
}));
vi.mock("../measurement/use-measurement-cache", () => ({
  useMeasurementCache: () => ({
    activeMeasurementEntry: null,
    activeReadyMeasurementEntry: null,
    pageCount: 1,
    previousChapterPageCount: 1,
    storeMeasurementEntry() {},
    warnFailedMeasurement() {},
  }),
}));
vi.mock("../restore/use-restore-controller", () => ({
  useRestoreController: () => "settled",
}));
vi.mock("../locator/use-locator-sync", () => ({ useLocatorSync() {} }));
vi.mock("../navigation/use-page-navigation", () => ({
  usePageNavigation: () => ({
    handleTouchEnd() {},
    handleTouchStart() {},
  }),
}));
vi.mock("../../overlays/highlights/highlights-context", () => ({
  useHighlightsContext: () => ({ highlights: [] }),
}));
vi.mock("../../overlays/ai-comments/ai-comments-context", () => ({
  useAiCommentsContext: () => ({ comments: [] }),
}));

it("cold-restores an ordinary endnote after a heading-only chapter without skipping a spread", () => {
  const intent = createInitialTraversalState(coldPayload).restoreIntent;
  expect(intent?.kind).toBe("block");
  expect(intent?.requestId).toBeUndefined();
  const cold = renderColdRestore(intent),
    explicit = renderColdRestore({ ...intent!, requestId: 1 });
  expect(cold.hasPrefix).toBe(false);
  expect(cold.html).toBe(explicit.html);
  const elements = nodes(parseFragment(cold.html));
  expect(
    attr(elements.find((n) => n.tagName === "article")!, "style"),
  ).toContain("left:-0px");
  expect(elements.some((n) => attr(n, "data-block-id") === "ch4")).toBe(false);
  expect(elements.some((n) => attr(n, "data-block-id") === "note-1")).toBe(
    true,
  );
  expect(elements.some((n) => attr(n, "role") === "doc-endnotes")).toBe(true);
  expect(text(parseFragment(cold.html))).toContain("A source endnote.");
  expect(text(parseFragment(cold.html))).toContain("After the note.");
  expect(
    elements.filter(
      (n) => n.tagName === "button" && text(n).startsWith("Reference"),
    ),
  ).toHaveLength(2);
});
it("keeps previous/next edge navigation in its measured chapter geometry", () => {
  const edge = createRestoreIntent("ch8", { edge: "start" }, "sequential");
  const desktop = renderColdRestore(edge);
  const back = renderColdRestore(
    createRestoreIntent("ch8", { edge: "end" }, "previous"),
  );
  expect(desktop.hasPrefix).toBe(false);
  expect(desktop.html).toContain("left:-0px");
  expect(back.hasPrefix).toBe(false);
  expect(back.html).toContain("left:-0px");
  box.width = 520;
  const mobile = renderColdRestore(edge);
  expect(mobile.hasPrefix).toBe(false);
  expect(mobile.html).toContain("left:-0px");
  box.width = 1088;
});
