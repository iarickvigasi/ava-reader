import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useNavigationQa } from "./use-navigation-qa";
const f = vi.hoisted(() => ({
  bound: false,
  cleanup: undefined as (() => void) | undefined,
  connect: vi.fn(),
  receive: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
  channel: vi.fn(),
}));
vi.mock("../qa/build-config", () => ({
  get READER_QA_ENABLED() {
    return f.bound;
  },
}));
vi.mock("./create-navigation-qa", () => ({
  createNavigationQa: () => {
    f.create();
    return { connect: f.connect, receive: f.receive };
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => (() => void) | undefined) => {
    f.cleanup = effect();
  },
}));
function Probe() {
  useNavigationQa();
  return null;
}
afterEach(() => {
  f.cleanup?.();
  f.cleanup = undefined;
  f.bound = false;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function setup(host: string, flag: string, bound: boolean) {
  f.bound = bound;
  vi.stubEnv("NEXT_PUBLIC_AVA_READER_QA", flag);
  vi.stubGlobal("window", { location: { hostname: host } });
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      onmessage = null;
      postMessage() {}
      close = f.close;
      constructor(name: string) {
        f.channel(name);
      }
    },
  );
  f.connect.mockReturnValue(vi.fn());
}
it.each([
  ["localhost", "1", false],
  ["localhost", "0", true],
  ["reader.example", "1", true],
] as const)(
  "creates no QA controller or listener when any gate fails (%s/%s/%s)",
  (host, flag, bound) => {
    setup(host, flag, bound);
    renderToStaticMarkup(<Probe />);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.channel).not.toHaveBeenCalled();
    expect(f.connect).not.toHaveBeenCalled();
  },
);
it("server rendering has no listener even with both flags enabled", () => {
  f.bound = true;
  vi.stubEnv("NEXT_PUBLIC_AVA_READER_QA", "1");
  vi.stubGlobal("window", undefined);
  renderToStaticMarkup(<Probe />);
  expect(f.create).not.toHaveBeenCalled();
  expect(f.channel).not.toHaveBeenCalled();
});
it("a scoped local QA runtime connects one channel and cleans it up", () => {
  setup("localhost", "1", true);
  renderToStaticMarkup(<Probe />);
  expect(f.create).toHaveBeenCalledOnce();
  expect(f.channel).toHaveBeenCalledExactlyOnceWith("ava-reader-qa");
  expect(f.connect).toHaveBeenCalledOnce();
  f.cleanup?.();
  f.cleanup = undefined;
  expect(f.connect.mock.results[0]!.value).toHaveBeenCalledOnce();
  expect(f.close).toHaveBeenCalledOnce();
});
