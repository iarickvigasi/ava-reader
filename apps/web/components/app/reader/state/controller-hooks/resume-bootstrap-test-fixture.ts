import { vi } from "vitest";
import { renderResumeRuntime } from "./resume-bootstrap-test-runtime";
import { useReaderResumeBootstrap } from "./use-reader-resume-bootstrap";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import type { InitialResumeBootstrapState } from "../../shared/types";

export function resumeFixture() {
  const payload = createReaderResumeFixturePayload();
  if (payload.status !== "READY") throw new Error("READY fixture required");
  payload.progress.locator = {
    chapterId: "chapter-2",
    blockId: "chapter-2::paragraph-long",
    textOffset: 18,
  };
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  type Input = Parameters<typeof useReaderResumeBootstrap>[0] & {
    accountId: string | null;
    cancelChapterLoad: () => void;
  };
  const input: Input = {
    accountId: "owner-a",
    cancelChapterLoad: vi.fn(),
    commitVisibleChapter: vi.fn(),
    currentReadyChapterId: "chapter-1",
    initialPayload: payload,
    initialResume: { phase: "selecting", snapshot: null },
    libraryItemId: payload.book.libraryItemId,
    loadChapterWindow: vi.fn(() => promise),
    loadedChaptersById: new Map(payload.chapters.map((c) => [c.chapterId, c])),
    payload,
    setInitialResume: vi.fn((next) => {
      input.initialResume =
        typeof next === "function" ? next(input.initialResume) : next;
    }),
    setVisibleLocator: vi.fn(),
  };
  const render = () =>
    renderResumeRuntime(() => {
      useReaderResumeBootstrap(input);
    });
  const phase = (): InitialResumeBootstrapState["phase"] =>
    input.initialResume.phase;
  return { input, payload, render, resolve, phase };
}
