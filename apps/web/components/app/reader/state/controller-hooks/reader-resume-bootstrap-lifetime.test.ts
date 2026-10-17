import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  resetResumeRuntime,
  replayResumeEffects,
  resumeTurn,
  unmountResumeRuntime,
} from "./resume-bootstrap-test-runtime";
import { resumeFixture } from "./resume-bootstrap-test-fixture";

beforeEach(() => {
  resetResumeRuntime();
  vi.clearAllMocks();
});
afterEach(() => unmountResumeRuntime());

it.each(["book", "account"])(
  "cancels an old %s load and rejects its late bootstrap settlement",
  async (scope) => {
    const f = resumeFixture();
    f.render();
    f.render();
    let resolveNext!: () => void;
    const next = new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
    f.input.loadChapterWindow = vi.fn(() => next);
    if (scope === "book") f.input.libraryItemId = "another-owned-book";
    else f.input.accountId = "owner-b";
    f.render();
    f.render();
    expect(f.input.cancelChapterLoad).toHaveBeenCalledTimes(1);
    expect(f.input.loadChapterWindow).toHaveBeenCalledTimes(1);
    f.resolve();
    await resumeTurn();
    expect(f.phase()).toBe("applying");
    resolveNext();
    await resumeTurn();
    expect(f.phase()).toBe("applied");
  },
);
it("ignores a deferred completion after leaving the reader", async () => {
  const f = resumeFixture();
  f.render();
  f.render();
  const calls = vi.mocked(f.input.setInitialResume).mock.calls.length;
  unmountResumeRuntime();
  expect(f.input.cancelChapterLoad).toHaveBeenCalledTimes(1);
  f.resolve();
  await resumeTurn();
  expect(f.phase()).toBe("applying");
  expect(f.input.setInitialResume).toHaveBeenCalledTimes(calls);
});
it("applies a newly selected snapshot instead of an in-flight older snapshot", async () => {
  const f = resumeFixture();
  f.render();
  f.render();
  let finish!: () => void;
  f.input.loadChapterWindow = vi.fn(
    () =>
      new Promise<void>((done) => {
        finish = done;
      }),
  );
  f.input.initialPayload = {
    ...f.payload,
    progress: {
      ...f.payload.progress,
      locator: {
        chapterId: "chapter-3",
        blockId: "chapter-3::paragraph-tail",
        textOffset: 7,
      },
    },
  };
  f.render();
  f.render();
  expect(f.input.cancelChapterLoad).toHaveBeenCalledTimes(1);
  expect(f.input.loadChapterWindow).toHaveBeenCalledWith("chapter-3", {
    blockId: "chapter-3::paragraph-tail",
    textOffset: 7,
  });
  f.resolve();
  await resumeTurn();
  expect(f.phase()).toBe("applying");
  finish();
  await resumeTurn();
  expect(f.phase()).toBe("applied");
});
it("starts one current attempt after development effect cleanup and setup replay", async () => {
  const f = resumeFixture();
  f.render();
  replayResumeEffects();
  f.render();
  expect(f.input.loadChapterWindow).toHaveBeenCalledTimes(1);
  f.resolve();
  await resumeTurn();
  expect(f.phase()).toBe("applied");
});
