import { afterEach, expect, it, vi } from "vitest";
import { useCoverBlobUrl } from "./use-cover-blob-url";
import { clearWarmCover, readWarmCover, rememberCover } from "./warm-cover";

const hooks = vi.hoisted(() => ({
  effect: null as null | (() => (() => void) | undefined),
  next: null as null | ((blob: Blob | null) => void),
  setResolved: vi.fn(),
}));
vi.mock("react", () => ({
  useState: () => [null, hooks.setResolved],
  useEffect: (effect: typeof hooks.effect) => {
    hooks.effect = effect;
  },
}));
vi.mock("dexie", () => ({
  liveQuery: () => ({
    subscribe: (observer: { next: typeof hooks.next }) => {
      hooks.next = observer.next;
      return { unsubscribe: vi.fn() };
    },
  }),
}));
vi.mock("./covers/read", () => ({ readCoverBlob: vi.fn() }));
vi.mock("../../db", () => ({ getActiveUserId: () => "reader-a" }));
afterEach(() => {
  clearWarmCover();
  vi.restoreAllMocks();
  hooks.setResolved.mockClear();
});

it.each([null, new Blob(["cover"])])(
  "keeps loaded artwork on the initial storage result %s",
  (blob) => {
    rememberCover(
      "book-a",
      { naturalWidth: 2, naturalHeight: 3 } as HTMLImageElement,
      "blob:warm",
    );
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:replacement");
    useCoverBlobUrl("book-a");
    const cleanup = hooks.effect!();
    hooks.next!(blob);
    expect(readWarmCover("book-a")?.src).toBe("blob:warm");
    expect(hooks.setResolved).toHaveBeenLastCalledWith({
      id: "book-a",
      url: "blob:warm",
    });
    expect(create).not.toHaveBeenCalled();
    hooks.next!(new Blob(["repaired"]));
    expect(readWarmCover("book-a")).toBeNull();
    expect(hooks.setResolved).toHaveBeenLastCalledWith({
      id: "book-a",
      url: "blob:replacement",
    });
    cleanup?.();
  },
);
