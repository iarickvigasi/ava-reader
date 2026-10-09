import { expect, it } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types/reader";
import { searchSourceIdentity } from "./source";

type Ready = Extract<ReaderStatusPayload, { status: "READY" }>;
const chapter = (id: string): ReaderChapterPayload => ({
  chapterId: id,
  href: id,
  label: id,
  title: id,
  spineIndex: 0,
  previousChapterId: null,
  nextChapterId: null,
  blocks: [
    {
      kind: "paragraph",
      id: "body",
      text: "😀e\u0301 four windows",
      inlines: [],
    },
  ],
});
const source = (): Ready => ({
  ...canonicalFixture(),
  readerPackage: undefined,
  chapters: [chapter("one")],
  chapterIds: ["one"],
  activeChapterId: "one",
  contentRevision: "a".repeat(64),
});

it("changes corpus identity for book, revision, canonical content or ordered spine changes", () => {
  const initial = source(),
    identity = searchSourceIdentity(initial);
  for (const next of [
    { ...initial, book: { ...initial.book, libraryItemId: "another" } },
    { ...initial, contentRevision: "b".repeat(64) },
    { ...initial, chapterIds: ["one", "two"] },
    { ...initial, chapterIds: ["two", "one"] },
    canonicalFixture(),
  ])
    expect(searchSourceIdentity(next)).not.toBe(identity);
  expect(
    searchSourceIdentity({
      ...initial,
      activeChapterId: "another",
      chapters: [],
    }),
  ).toBe(identity);
});

it("binds a canonical corpus to its accepted content ID and digest", () => {
  const initial = canonicalFixture(),
    pkg = initial.readerPackage!,
    identity = searchSourceIdentity(initial);
  expect(
    searchSourceIdentity({
      ...initial,
      readerPackage: { ...pkg, final_content_id: "another" },
    }),
  ).not.toBe(identity);
  expect(
    searchSourceIdentity({
      ...initial,
      readerPackage: { ...pkg, canonical_sha256: "b".repeat(64) },
    }),
  ).not.toBe(identity);
});
