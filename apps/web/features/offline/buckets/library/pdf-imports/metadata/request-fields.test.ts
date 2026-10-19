import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { metadataDraft, type PdfMetadata } from "@/lib/api-types/pdf-metadata";
import { getDb, __resetDbForTests } from "../../../../db";
import { applyBookInfoPayload } from "../../book-info/write-book-info";
import { requestPdfMetadata } from "./request";
import { book, edited } from "./test-fixture";

const snapshot: PdfMetadata = {
  ...edited,
  metadataEditVersion: 0,
  title: book.title,
  authors: book.authors,
  language: book.language,
};
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyBookInfoPayload(book);
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
});
function input() {
  return {
    db: getDb(),
    getToken: vi.fn(async () => "test-token"),
    operationId: snapshot.operationId,
    libraryItemId: snapshot.libraryItemId,
  };
}
it.each([
  {
    name: "title",
    draft: { title: " New title " },
    changes: { title: "New title" },
  },
  {
    name: "author",
    draft: { authors: " New author \n" },
    changes: { authors: ["New author"] },
  },
  {
    name: "language",
    draft: { language: " uk " },
    changes: { language: "uk" },
  },
  { name: "author clear", draft: { authors: " \n" }, changes: { authors: [] } },
  {
    name: "language clear",
    draft: { language: " " },
    changes: { language: null },
  },
])(
  "sends only the changed $name field with the snapshot version",
  async ({ draft, changes }) => {
    const response = { ...snapshot, ...changes, metadataEditVersion: 1 };
    const fetch = vi.fn<
      (url: string, options?: RequestInit) => Promise<Response>
    >(async () => Response.json(response));
    vi.stubGlobal("fetch", fetch);
    await requestPdfMetadata({
      ...input(),
      edit: { snapshot, draft: { ...metadataDraft(snapshot), ...draft } },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const options = fetch.mock.calls[0][1];
    expect(JSON.parse(options!.body as string)).toEqual({
      ...changes,
      expectedVersion: 0,
    });
    const cached = await getDb().libraryItems.get(snapshot.libraryItemId);
    expect(cached?.title).toBe(response.title);
    expect(cached?.authors).toEqual(response.authors);
    expect(cached?.details?.language).toBe(response.language);
  },
);
it("a queued title edit does not claim untouched empty author or language", async () => {
  const pending = { ...snapshot, authors: [], language: null };
  const fetch = vi.fn<
    (url: string, options?: RequestInit) => Promise<Response>
  >(async () =>
    Response.json({ ...pending, title: "My title", metadataEditVersion: 1 }),
  );
  vi.stubGlobal("fetch", fetch);
  await requestPdfMetadata({
    ...input(),
    edit: {
      snapshot: pending,
      draft: { title: "My title", authors: "", language: "" },
    },
  });
  const options = fetch.mock.calls[0][1];
  expect(JSON.parse(options!.body as string)).toEqual({
    title: "My title",
    expectedVersion: 0,
  });
});
it.each([snapshot, { ...snapshot, authors: [], language: null }])(
  "does not transport or write a normalized unchanged save",
  async (unchanged) => {
    const fetch = vi.fn(async () => Response.json(edited));
    vi.stubGlobal("fetch", fetch);
    const request = input();
    const draft = metadataDraft(unchanged);
    await expect(
      requestPdfMetadata({
        ...request,
        edit: {
          snapshot: unchanged,
          draft: {
            title: ` ${draft.title} `,
            authors: `\n${draft.authors}\n`,
            language: ` ${draft.language} `,
          },
        },
      }),
    ).resolves.toEqual(unchanged);
    expect(fetch).not.toHaveBeenCalled();
    expect(request.getToken).not.toHaveBeenCalled();
    expect(
      (await getDb().libraryItems.get(snapshot.libraryItemId))
        ?.metadataEditVersion,
    ).toBe(0);
    expect(await getDb().meta.toArray()).toEqual([]);
  },
);
