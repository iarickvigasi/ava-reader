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
const readers: FakeReader[] = [];
class FakeReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  abort = vi.fn();
  readAsDataURL = vi.fn();
  constructor() {
    readers.push(this);
  }
  finish(value: string) {
    this.result = value;
    this.onload?.();
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  readers.length = 0;
});

it("keeps a cached photo usable across metadata refreshes without blob URLs", () => {
  vi.stubGlobal("FileReader", FakeReader);
  useAvatarBlobUrl();
  const cleanup = hooks.effect!();
  hooks.next!(new Blob(["photo"]));
  readers[0].finish("data:image/jpeg;base64,photo");
  expect(hooks.set).toHaveBeenLastCalledWith("data:image/jpeg;base64,photo");
  hooks.next!(new Blob(["photo"]));
  expect(hooks.set).toHaveBeenLastCalledWith("data:image/jpeg;base64,photo");
  readers[1].finish("data:image/jpeg;base64,photo");
  cleanup();
  expect(hooks.unsubscribe).toHaveBeenCalledOnce();
});

it("cancels superseded reads and ignores their late results", () => {
  vi.stubGlobal("FileReader", FakeReader);
  useAvatarBlobUrl();
  const cleanup = hooks.effect!();
  hooks.next!(new Blob(["old"]));
  const late = readers[0].onload!;
  hooks.next!(new Blob(["new"]));
  expect(readers[0].abort).toHaveBeenCalledOnce();
  readers[1].finish("data:image/jpeg;base64,new");
  readers[0].result = "data:image/jpeg;base64,old";
  late();
  expect(hooks.set).toHaveBeenLastCalledWith("data:image/jpeg;base64,new");
  cleanup();
});

it("clears removed photos and prevents updates after unmount", () => {
  vi.stubGlobal("FileReader", FakeReader);
  useAvatarBlobUrl();
  const cleanup = hooks.effect!();
  hooks.next!(null);
  expect(hooks.set).toHaveBeenLastCalledWith(null);
  hooks.next!(new Blob(["photo"]));
  const late = readers[0].onload!;
  cleanup();
  hooks.set.mockClear();
  late();
  expect(hooks.set).not.toHaveBeenCalled();
  expect(readers[0].abort).toHaveBeenCalledOnce();
});
