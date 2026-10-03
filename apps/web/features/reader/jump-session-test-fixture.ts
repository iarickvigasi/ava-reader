import { vi } from "vitest";
import type { ReaderLocator } from "@/lib/api-types";
import { createRestoreIntent } from "./navigation";
import { createJumpSession } from "./jump-session";
import { emptyJumpHistory } from "./jump-history";
export const a = { chapterId: "one", blockId: "unicode-body", textOffset: 3 };
export const b = { chapterId: "one", blockId: "figure", textOffset: 0 };
export const c = { chapterId: "four", blockId: "heading", textOffset: 0 };
export const flushRequests = () =>
  new Promise<void>((resolve) => setImmediate(resolve));
export function jumpFixture() {
  const view = {
    state: emptyJumpHistory(),
    error: null as string | null,
    origin: a as ReaderLocator | null,
  };
  const navigate =
    vi.fn<(target: ReaderLocator, sequence: number) => void | Promise<void>>();
  const focus = vi.fn();
  const session = createJumpSession({
    origin: () => view.origin,
    navigate,
    focus,
    arrive: (target) => {
      view.origin = target;
    },
    leave: () => {
      view.origin = null;
    },
    publish: (state, error) => {
      view.state = state;
      view.error = error;
    },
  });
  const intent = () => {
    const pending = view.state.pending!;
    return createRestoreIntent(
      pending.destination.chapterId,
      { ...pending.destination, requestId: pending.sequence },
      `test-${pending.sequence}`,
    );
  };
  return { session, view, navigate, focus, intent };
}
