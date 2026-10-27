import { afterEach, expect, it, vi } from "vitest";
import { useAvatarBlobUrl } from "./use-avatar-blob-url";

const hooks = vi.hoisted(() => ({
  effect: null as null | (() => () => void),
  next: null as null | ((blob: Blob | null) => void),
  set: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("react", () => ({
  useState: () => [undefined, hooks.set],
  useEffect: (effect: typeof hooks.effect) => {
    hooks.effect = effect;
  },
}));
vi.mock("dexie", () => ({
  liveQuery: () => ({
    subscribe: (observer: { next: typeof hooks.next }) => {
      hooks.next = observer.next;
      return { unsubscribe: hooks.unsubscribe };
    },
  }),
}));
vi.mock("./storage", () => ({ readAvatarBlob: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("updates an already mounted avatar when a missing photo is cached", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  useAvatarBlobUrl();
  const cleanup = hooks.effect!();
  hooks.next!(null);
  expect(hooks.set).toHaveBeenLastCalledWith(null);
  hooks.next!(new Blob(["photo"]));
  expect(hooks.set).toHaveBeenLastCalledWith("blob:photo");
  cleanup();
  expect(hooks.unsubscribe).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith("blob:photo");
});
