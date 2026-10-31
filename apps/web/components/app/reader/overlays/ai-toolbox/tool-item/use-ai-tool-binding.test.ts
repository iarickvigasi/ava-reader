import { beforeEach, expect, it, vi } from "vitest";
import { useAiToolBinding } from "./use-ai-tool-binding";

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => effect(),
}));
vi.mock("../../ai-comments/ai-comments-context", () => ({
  useAiCommentsContext: () => ({ enqueueGenerateIntent: enqueue }),
}));
vi.mock("@/features/offline/buckets/ai-comments", () => ({
  generateAiCommentId: () => "request-id",
}));

beforeEach(() => enqueue.mockClear());

const input = {
  libraryItemId: "book",
  isOpen: true,
  selection: "passage",
  payload: { kind: "explain" as const, text: "passage", context: "sentence" },
};

it("saves an online request without requiring loaded authentication", () => {
  vi.stubGlobal("navigator", { onLine: true });
  useAiToolBinding(input);
  expect(enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "generate.explain",
      payload: expect.objectContaining({
        text: "passage",
        context: "sentence",
      }),
    }),
  );
  vi.unstubAllGlobals();
});

it("retries a failed request through the durable queue", () => {
  const view = useAiToolBinding({
    ...input,
    saved: { body: "", status: "failed", error: "Rejected" },
  });
  expect(enqueue).not.toHaveBeenCalled();
  view.retry?.();
  expect(enqueue).toHaveBeenCalledOnce();
  expect(enqueue).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({ regenerationId: "request-id" }),
    }),
  );
});

it("keeps an existing pending request and displays the queued placeholder", () => {
  const view = useAiToolBinding({
    ...input,
    saved: { body: "", status: "queued", error: null },
  });
  expect(enqueue).not.toHaveBeenCalled();
  expect(view.phase).toBe("queued");
  expect(view.error).toBeNull();
});
