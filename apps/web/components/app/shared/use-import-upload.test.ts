import { beforeEach, expect, it, vi } from "vitest";
import { useImportUpload } from "./use-import-upload";
const mocks = vi.hoisted(() => ({ push: vi.fn(), imported: vi.fn() }));
vi.mock("react", () => ({
  useTransition: () => [false, (run: () => Promise<void>) => run()],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    getToken: async () => "test",
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
beforeEach(() => vi.clearAllMocks());
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
