import { expect, it, vi } from "vitest";
import { fixture, chapter } from "./restore-position-test-fixture";

it("holds the valid passage until a replaced DOM owner is freshly measured", () => {
  const f = fixture({
    kind: "block",
    chapterId: chapter,
    blockId: "p4-graphic0",
    textOffset: 14,
    key: "exact:14",
  });
  f.input.currentPageIndex = 2;
  const stale = vi.fn(
    () => ({ status: "exact", column: 1, pageIndex: 0 }) as const,
  );
  f.input.activeMeasurementEntry = {
    chapterId: chapter,
    layoutKey: "100",
    status: "ready",
    pageCount: 3,
    isCurrent: () => false,
    resolveLocator: () => null,
    resolvePageIndex: stale,
  };
  f.render();
  expect(f.input.currentPageIndex).toBe(2);
  expect(stale).not.toHaveBeenCalled();
  expect(f.hooks.settle).not.toHaveBeenCalled();
  expect(f.input.restoreIntent).toMatchObject({ textOffset: 14 });
  expect(f.layout("fresh", 4, { "p4-graphic0": 1 })).toBe(1);
  expect(f.hooks.settle).toHaveBeenCalledOnce();
});

it.each(["block", "edge-end"] as const)(
  "does not consume a %s jump when its DOM owner retires before the settle frame",
  (kind) => {
    const f = fixture(
      kind === "block"
        ? {
            kind,
            chapterId: chapter,
            blockId: "p4-graphic0",
            textOffset: 14,
            key: "deferred",
          }
        : { kind, sticky: true, chapterId: chapter, key: "deferred" },
    );
    const frames: (() => unknown)[] = [];
    f.input.scheduleSettle = (_key, callback) => {
      if (callback) frames.push(callback);
    };
    let live = true;
    f.layout("same-key", 3, { "p4-graphic0": 1 });
    if (f.input.activeMeasurementEntry?.status !== "ready")
      throw new Error("EXPECTED_READY");
    f.input.activeMeasurementEntry.isCurrent = () => live;
    live = false;
    expect(frames.at(-1)?.()).toBe(false);
    expect(f.hooks.settle).not.toHaveBeenCalled();
    expect(f.input.restoreIntent?.key).toBe("deferred");
    f.layout("same-key", 4, { "p4-graphic0": 2 });
    frames.at(-1)?.();
    expect(f.hooks.settle).toHaveBeenCalledOnce();
    expect(f.input.currentPageIndex).toBe(kind === "block" ? 2 : 3);
  },
);
