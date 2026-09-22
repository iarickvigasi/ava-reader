import { describe, expect, it } from "vitest";
import { createRestoreIntent } from "../navigation";
import { resolveReaderModeRestore } from "./resolve-mode-restore";
import type { ReaderModeRestoreInput } from "./mode-restore-types";

const input: ReaderModeRestoreInput = {
  isBilingual: false,
  libraryItemId: "book",
  activeChapterId: "c",
  restoreIntent: createRestoreIntent("c", { edge: "start" }, "initial:c"),
  visibleLocator: { chapterId: "c", blockId: "b", textOffset: 100 },
};

describe("reader mode transition restores", () => {
  it("leaves the initial ordinary mount and ongoing progress free of artificial restores", () => {
    const first = resolveReaderModeRestore(null, input);
    expect(first.override).toBeNull();
    expect(resolveReaderModeRestore(first, input)).toBe(first);
    const progress = {
      ...input,
      visibleLocator: { ...input.visibleLocator!, textOffset: 200 },
    };
    const next = resolveReaderModeRestore(first, progress);
    expect(next.override).toBeNull();
    expect(next.latestLocator?.textOffset).toBe(200);
    expect(resolveReaderModeRestore(next, progress)).toBe(next);
  });

  it("restores the latest source position on each mode change with a new cycle key", () => {
    const initial = resolveReaderModeRestore(null, input);
    const entered = resolveReaderModeRestore(initial, {
      ...input,
      isBilingual: true,
    });
    expect(entered.override).toMatchObject({
      kind: "block",
      chapterId: "c",
      blockId: "b",
      textOffset: 100,
    });
    const progress = {
      ...input,
      isBilingual: true,
      visibleLocator: { ...input.visibleLocator!, textOffset: 800 },
    };
    const advanced = resolveReaderModeRestore(entered, progress);
    expect(advanced.override).toBe(entered.override);
    const exited = resolveReaderModeRestore(advanced, {
      ...progress,
      isBilingual: false,
    });
    expect(exited.override).toMatchObject({ kind: "block", textOffset: 800 });
    expect(exited.override?.key).not.toBe(entered.override?.key);
    expect(
      resolveReaderModeRestore(exited, { ...progress, isBilingual: false }),
    ).toBe(exited);
  });

  it("retains the most recent source anchor through a temporarily absent locator", () => {
    const initial = resolveReaderModeRestore(null, input);
    const entered = resolveReaderModeRestore(initial, {
      ...input,
      isBilingual: true,
      visibleLocator: null,
    });
    expect(entered.override).toMatchObject({ textOffset: 100 });
    expect(
      resolveReaderModeRestore(entered, {
        ...input,
        isBilingual: true,
        visibleLocator: null,
      }),
    ).toBe(entered);
  });

  it("lets explicit same-chapter navigation replace an override, including during a mode change", () => {
    const entered = resolveReaderModeRestore(
      resolveReaderModeRestore(null, input),
      { ...input, isBilingual: true },
    );
    const navigation = {
      ...input,
      restoreIntent: createRestoreIntent(
        "c",
        { blockId: "target", textOffset: 5 },
        "toc:2",
      ),
    };
    expect(
      resolveReaderModeRestore(entered, { ...navigation, isBilingual: true })
        .override,
    ).toBeNull();
    expect(resolveReaderModeRestore(entered, navigation).override).toBeNull();
  });

  it("clears the override for another chapter or book and rejects their stale locators", () => {
    const entered = resolveReaderModeRestore(
      resolveReaderModeRestore(null, input),
      { ...input, isBilingual: true },
    );
    const chapter = resolveReaderModeRestore(entered, {
      ...input,
      activeChapterId: "next",
      isBilingual: false,
      restoreIntent: createRestoreIntent(
        "next",
        { edge: "start" },
        "chapter:next",
      ),
    });
    expect(chapter.override).toBeNull();
    expect(chapter.latestLocator).toBeNull();
    expect(
      resolveReaderModeRestore(entered, { ...input, libraryItemId: "other" })
        .override,
    ).toBeNull();
  });

  it("does not invent an anchor before any visible location has been published", () => {
    const empty = { ...input, visibleLocator: null };
    const initial = resolveReaderModeRestore(null, empty);
    expect(
      resolveReaderModeRestore(initial, { ...empty, isBilingual: true })
        .override,
    ).toBeNull();
    expect(
      resolveReaderModeRestore(null, { ...empty, isBilingual: true }).override,
    ).toBeNull();
  });
});
