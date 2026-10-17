import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  resetResumeRuntime,
  resumeTurn,
  unmountResumeRuntime,
} from "./resume-bootstrap-test-runtime";
import { resumeFixture } from "./resume-bootstrap-test-fixture";

beforeEach(() => {
  resetResumeRuntime();
  vi.clearAllMocks();
});
afterEach(() => unmountResumeRuntime());

it("finishes initial resume when payload and callback identities change during the chapter load", async () => {
  const f = resumeFixture();
  f.render();
  f.render();
  expect(f.input.loadChapterWindow).toHaveBeenCalledTimes(1);
  expect(f.phase()).toBe("applying");
  f.input.payload = { ...f.payload };
  f.input.currentReadyChapterId = "chapter-2";
  f.input.loadedChaptersById = new Map(f.input.loadedChaptersById);
  f.input.loadChapterWindow = vi.fn(async () => {});
  f.render();
  f.resolve();
  await resumeTurn();
  expect(f.phase()).toBe("applied");
  expect(f.input.loadChapterWindow).not.toHaveBeenCalled();
});

it("commits an already visible resume target without loading or leaving bootstrap pending", () => {
  const f = resumeFixture();
  f.input.currentReadyChapterId = "chapter-2";
  f.render();
  f.render();
  expect(f.phase()).toBe("applied");
  expect(f.input.loadChapterWindow).not.toHaveBeenCalled();
  expect(f.input.commitVisibleChapter).toHaveBeenCalledWith("chapter-2", {
    blockId: "chapter-2::paragraph-long",
    textOffset: 18,
  });
});
