import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { importPdfFile } from "./mutations";
import { pdfStatus } from "./test-fixture";
import { pendingPdfUploadIntents } from "./storage";

vi.mock("../revalidate", () => ({ revalidateLibrary: vi.fn() }));
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => {
  __resetDbForTests();
  vi.unstubAllGlobals();
});
it("reconciles an accepted upload whose response was lost without another POST", async () => {
  let accepted = false;
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === "POST") {
      expect((init.body as FormData).get("originalFilename")).toBe("Книга ґрунт.pdf");
      accepted = true;
      throw new Error("lost response");
    }
    return accepted
      ? Response.json(pdfStatus)
      : new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  const file = new File(["%PDF-test"], "Книга ґрунт.pdf", { type: "application/pdf" });
  expect((await importPdfFile(file, async () => "token")).state).toBe(
    "uncertain",
  );
  expect(await importPdfFile(file, async () => "token")).toMatchObject({
    state: "existing",
    libraryItemId: pdfStatus.libraryItemId,
  });
  expect(
    fetcher.mock.calls.filter((call) => call[1].method === "POST"),
  ).toHaveLength(1);
  expect(await pendingPdfUploadIntents(getDb())).toEqual([]);
});
it("keeps duplicate source identity and stops polling definitive admission rejection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init: RequestInit) =>
      init.method === "POST"
        ? Response.json({ code: "UNSUPPORTED_PDF" }, { status: 422 })
        : new Response(null, { status: 404 }),
    ),
  );
  expect(
    (await importPdfFile(new File(["bad"], "bad.pdf"), async () => "token"))
      .state,
  ).toBe("rejected");
  expect(await pendingPdfUploadIntents(getDb())).toEqual([]);
});
