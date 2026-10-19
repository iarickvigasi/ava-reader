import { beforeEach, expect, it, vi } from "vitest";
import { useImportUpload } from "./use-import-upload";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  imported: vi.fn(),
  userId: undefined as string | undefined,
  sessionId: undefined as string | undefined,
  ref: undefined as
    | { current: { ownerKey: string | undefined; generation: number } }
    | undefined,
  cleanup: undefined as (() => void) | undefined,
  layouts: [] as (() => () => void)[],
}));
vi.mock("react", () => ({
  useRef: (initial: { ownerKey: string | undefined; generation: number }) =>
    (mocks.ref ??= { current: initial }),
  useLayoutEffect: (run: () => () => void) => {
    mocks.layouts.push(run);
  },
  useTransition: () => [false, (run: () => Promise<void>) => run()],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    getToken: async () => "test",
    userId: mocks.userId,
    sessionId: mocks.sessionId,
    isLoaded: true,
    isSignedIn: true,
  }),
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => true,
}));
vi.mock("@/features/offline/buckets/library", () => ({
  importPdfFile: mocks.imported,
  revalidateLibrary: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ref = undefined;
  mocks.cleanup = undefined;
  mocks.layouts = [];
  mocks.userId = undefined;
  mocks.sessionId = undefined;
});
it.each(["accepted", "existing"])(
  "opens the owned slug after a %s PDF receipt, not its internal ID",
  async (state) => {
    mocks.imported.mockResolvedValue({
      state,
      libraryItemId: "internal-item",
      slug: "reader book",
    });
    const notice = vi.fn();
    useImportUpload({ onNoticeAction: notice }).upload(
      new File(["pdf"], "book.pdf"),
    );
    await vi.waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/app/library/books/reader%20book",
      ),
    );
    expect(notice).toHaveBeenCalledWith(state);
  },
);
it("opens Library when acceptance is known but revalidation has not supplied its slug", async () => {
  mocks.imported.mockResolvedValue({
    state: "accepted",
    libraryItemId: "internal-item",
  });
  useImportUpload({ onNoticeAction: vi.fn() }).upload(
    new File(["pdf"], "book.pdf"),
  );
  await vi.waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith("/app/library"),
  );
});
it("does not navigate on an uncertain account or transport outcome", async () => {
  mocks.imported.mockResolvedValue({ state: "uncertain" });
  const notice = vi.fn();
  useImportUpload({ onNoticeAction: notice }).upload(
    new File(["pdf"], "book.pdf"),
  );
  await vi.waitFor(() => expect(notice).toHaveBeenCalledWith("uncertain"));
  expect(mocks.push).not.toHaveBeenCalled();
});

it("presents an explicit copy choice without navigating or dispatching a second upload", async () => {
  const file = new File(["pdf"], "Book.pdf"),
    duplicate = {
      state: "duplicate",
      libraryItemId: "existing",
      operationId: "pdf-original",
      requestKey: "old-key",
      slug: "existing-book",
    };
  mocks.imported.mockResolvedValue(duplicate);
  const onDuplicateAction = vi.fn();
  useImportUpload({ onNoticeAction: vi.fn(), onDuplicateAction }).upload(file);
  await vi.waitFor(() =>
    expect(onDuplicateAction).toHaveBeenCalledWith(file, duplicate, undefined),
  );
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.imported).toHaveBeenCalledTimes(1);
});
it("carries explicit copy confirmation through the normal import gate", async () => {
  const file = new File(["pdf"], "Book.pdf"),
    copy = { operationId: "pdf-original", requestKey: "old-key" };
  mocks.imported.mockResolvedValue({ state: "uncertain" });
  useImportUpload({ onNoticeAction: vi.fn() }).upload(file, copy);
  await vi.waitFor(() =>
    expect(mocks.imported).toHaveBeenCalledWith(
      file,
      expect.any(Function),
      copy,
    ),
  );
});

function commitLayoutEffects() {
  for (const run of mocks.layouts.splice(0)) {
    mocks.cleanup?.();
    mocks.cleanup = run();
  }
}
it.each(["duplicate", "accepted", "error"])(
  "discards a late %s completion after account/session replacement",
  async (state) => {
    mocks.userId = "owner-a";
    mocks.sessionId = "session-a";
    let resolve!: (v: unknown) => void;
    let reject!: (e: Error) => void;
    mocks.imported.mockImplementationOnce(
      () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    const notice = vi.fn(),
      duplicate = vi.fn();
    const mounted = useImportUpload({
      onNoticeAction: notice,
      onDuplicateAction: duplicate,
    });
    commitLayoutEffects();
    mounted.upload(new File(["pdf"], "Book.pdf"));
    commitLayoutEffects();
    mocks.userId = "owner-b";
    mocks.sessionId = "session-b";
    useImportUpload({ onNoticeAction: notice, onDuplicateAction: duplicate });
    commitLayoutEffects();
    mocks.userId = "owner-a";
    mocks.sessionId = "session-new";
    useImportUpload({ onNoticeAction: notice, onDuplicateAction: duplicate });
    commitLayoutEffects();
    if (state === "error") reject(Error("late"));
    else
      resolve({
        state,
        libraryItemId: "old-item",
        operationId: "old-op",
        requestKey: "old-key",
        slug: "old-book",
      });
    await new Promise((done) => setImmediate(done));
    expect(notice).not.toHaveBeenCalled();
    expect(duplicate).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  },
);
it("keeps a newer selection when an older upload completes later", async () => {
  let first!: (v: unknown) => void;
  mocks.imported
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    )
    .mockResolvedValueOnce({
      state: "accepted",
      libraryItemId: "new",
      slug: "new-book",
    });
  const notice = vi.fn(),
    duplicate = vi.fn(),
    hook = useImportUpload({
      onNoticeAction: notice,
      onDuplicateAction: duplicate,
    });
  hook.upload(new File(["pdf"], "Old.pdf"));
  hook.upload(new File(["pdf"], "New.pdf"));
  await vi.waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith("/app/library/books/new-book"),
  );
  first({ state: "duplicate", operationId: "old", requestKey: "old" });
  await new Promise((done) => setImmediate(done));
  expect(duplicate).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(notice).toHaveBeenCalledTimes(1);
});
