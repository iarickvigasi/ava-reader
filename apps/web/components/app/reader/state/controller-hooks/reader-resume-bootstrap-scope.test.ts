import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  resetResumeRuntime,
  resumeTurn,
  unmountResumeRuntime,
} from "./resume-bootstrap-test-runtime";
import { resumeFixture } from "./resume-bootstrap-test-fixture";
import { applyReaderResumeAttempt } from "./apply-reader-resume-attempt";
import type { InitialResumeBootstrapState } from "../../shared/types";
import type { ResumeAttempt } from "./use-reader-resume-bootstrap.types";

beforeEach(() => {
  resetResumeRuntime();
  vi.clearAllMocks();
});
afterEach(() => unmountResumeRuntime());

it("starts the new account attempt with no saved position and otherwise identical inputs", async () => {
  const f = resumeFixture();
  f.payload.progress.locator = null;
  f.input.currentReadyChapterId = "chapter-2";
  f.render();
  f.render();
  expect(f.input.initialResume.snapshot).toBeNull();
  expect(f.input.loadChapterWindow).toHaveBeenCalledTimes(1);
  f.input.accountId = "owner-b";
  f.render();
  f.render();
  expect(f.input.cancelChapterLoad).toHaveBeenCalledTimes(1);
  expect(f.input.loadChapterWindow).toHaveBeenCalledTimes(2);
  f.resolve();
  await resumeTurn();
  expect(f.phase()).toBe("applied");
});

it.each(["cancelled", "replaced"])(
  "ignores a queued %s attempt settlement when React evaluates it later",
  async (kind) => {
    const f = resumeFixture();
    let queued:
      | ((state: InitialResumeBootstrapState) => InitialResumeBootstrapState)
      | undefined;
    const attempt: ResumeAttempt = {
      active: true,
      started: true,
      snapshot: null,
    };
    const promise = applyReaderResumeAttempt(
      {
        ...f.input,
        payload: f.payload,
        setInitialResume: (update) => {
          if (typeof update === "function") queued = update;
        },
      },
      attempt,
    );
    f.resolve();
    await promise;
    expect(queued).toBeTypeOf("function");
    if (kind === "cancelled") attempt.active = false;
    const newer: InitialResumeBootstrapState = {
      phase: "applying",
      snapshot:
        kind === "replaced"
          ? {
              version: 2,
              savedAt: "",
              locator: {
                chapterId: "chapter-3",
                blockId: "chapter-3::paragraph-tail",
                textOffset: 7,
              },
            }
          : null,
    };
    expect(queued!(newer)).toBe(newer);
  },
);
