import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { importPdfFile } from "./mutations";
import { pendingPdfUploadIntents } from "./storage";
import { pdfStatus } from "./test-fixture";

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
const file = () =>
  new File(["%PDF-refusal-fixture"], "book.pdf", { type: "application/pdf" });
async function sourceHash(source: File) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await source.arrayBuffer()),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
const refusal = (requestKey: string, sourceSha256: string) => ({
  code: "PDF_ADMISSION_REFUSED",
  investigationId: "pdf-owned-refusal",
  requestKey,
  sourceSha256,
  operationId: null,
});
it("resolves a503 with confirmed refusal, and only the next explicit selection sends unchanged bytes with a fresh key", async () => {
  const source = file(),
    hash = await sourceHash(source),
    keys: string[] = [],
    uploads: string[] = [];
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === "POST") {
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
      uploads.push(await ((init.body as FormData).get("file") as File).text());
      return keys.length === 1
        ? Response.json({ code: "PDF_ADMISSION_UNAVAILABLE" }, { status: 503 })
        : Response.json({ libraryItemId: "lib-1" });
    }
    return keys.length === 1 &&
      decodeURIComponent(_url.split("/").at(-1)!) === keys[0]
      ? Response.json(refusal(keys[0], hash), { status: 410 })
      : new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  expect(await importPdfFile(source, async () => "token")).toMatchObject({
    state: "rejected",
    code: "PDF_ADMISSION_REFUSED",
  });
  expect(keys).toHaveLength(1);
  expect(await pendingPdfUploadIntents(getDb())).toEqual([]);
  expect(await importPdfFile(source, async () => "token")).toMatchObject({
    state: "accepted",
    libraryItemId: "lib-1",
  });
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
  expect(uploads).toEqual(["%PDF-refusal-fixture", "%PDF-refusal-fixture"]);
});
it.each([
  "missing",
  "active",
  "network",
  "malformed",
  "generic410",
  "wrongKey",
  "wrongHash",
  "hasOperation",
  "missingOperation",
  "emptyAcceptedItem",
  "emptyAcceptedOperation",
])(
  "never resends or rotates an unresolved prior intent after %s lookup",
  async (kind) => {
    const source = file(),
      hash = await sourceHash(source);
    let key = "",
      posted = false;
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        posted = true;
        key = (init.headers as Record<string, string>)["Idempotency-Key"];
        throw new Error("lost response");
      }
      if (!posted || kind === "missing")
        return new Response(null, { status: 404 });
      if (kind === "emptyAcceptedItem")
        return Response.json({ ...pdfStatus, libraryItemId: "" });
      if (kind === "emptyAcceptedOperation")
        return Response.json({ ...pdfStatus, operationId: "" });
      if (kind === "network") throw new Error("offline");
      if (kind === "malformed") return new Response("{", { status: 410 });
      if (kind === "active")
        return Response.json(
          { code: "PDF_ADMISSION_PENDING" },
          { status: 409 },
        );
      if (kind === "generic410")
        return Response.json(
          { message: "This import was deleted." },
          { status: 410 },
        );
      const body: Record<string, unknown> = refusal(key, hash);
      if (kind === "wrongKey") body.requestKey = "another-request";
      if (kind === "wrongHash") body.sourceSha256 = "a".repeat(64);
      if (kind === "hasOperation") body.operationId = "operation";
      if (kind === "missingOperation") delete body.operationId;
      return Response.json(body, { status: 410 });
    });
    vi.stubGlobal("fetch", fetcher);
    expect((await importPdfFile(source, async () => "token")).state).toBe(
      "uncertain",
    );
    expect((await importPdfFile(source, async () => "token")).state).toBe(
      "uncertain",
    );
    expect(
      fetcher.mock.calls.filter((call) => call[1].method === "POST"),
    ).toHaveLength(1);
    expect((await pendingPdfUploadIntents(getDb()))[0].requestKey).toBe(key);
  },
);
it.each(["FAILED", "STOPPED", "READY"])(
  "keeps accepted %s content fixed on explicit reselection",
  async (status) => {
    let posted = false;
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        posted = true;
        throw new Error("lost response");
      }
      return posted
        ? Response.json({
            ...pdfStatus,
            status,
            finalContentId: status === "READY" ? "fixed-content" : null,
          })
        : new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);
    expect((await importPdfFile(file(), async () => "token")).state).toBe(
      "uncertain",
    );
    expect((await importPdfFile(file(), async () => "token")).state).toBe(
      "existing",
    );
    expect(
      fetcher.mock.calls.filter((call) => call[1].method === "POST"),
    ).toHaveLength(1);
  },
);
