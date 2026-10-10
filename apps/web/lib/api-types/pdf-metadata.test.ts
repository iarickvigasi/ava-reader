import { expect, it } from "vitest";
import {
  metadataChanges,
  metadataPatch,
  readPdfMetadata,
} from "./pdf-metadata";
const valid = {
  operationId: "operation",
  libraryItemId: "library",
  metadataEditVersion: 1,
  title: "Title",
  authors: [],
  language: null,
};
it("normalizes optional display fields without adding conversion fields", () => {
  expect(
    metadataChanges({ title: " Title ", authors: " A \nB\n ", language: "" }),
  ).toEqual({ title: "Title", authors: ["A", "B"], language: null });
});
it("keeps the existing API field bounds", () => {
  for (const patch of [
    { title: "" },
    { title: "x".repeat(1001) },
    { authors: Array(101).fill("A").join("\n") },
    { language: "e" },
    { language: "x".repeat(36) },
  ])
    expect(
      metadataChanges({
        title: "Title",
        authors: "",
        language: "en",
        ...patch,
      }),
    ).toBeNull();
});
it("compares normalized values while preserving author order and explicit clears", () => {
  const snapshot = { ...valid, authors: ["A", "B"], language: "en" };
  expect(
    metadataPatch(snapshot, {
      title: " Title ",
      authors: " A\r\n B ",
      language: " en ",
    }),
  ).toBeNull();
  expect(
    metadataPatch(snapshot, {
      title: "Title",
      authors: "B\nA",
      language: "en",
    }),
  ).toEqual({ authors: ["B", "A"] });
  expect(
    metadataPatch(snapshot, { title: "Title", authors: "", language: "" }),
  ).toEqual({ authors: [], language: null });
  expect(
    metadataPatch(snapshot, { title: "", authors: "A\nB", language: "en" }),
  ).toBeNull();
});
it("refuses malformed snapshot identity/version and data", () => {
  expect(readPdfMetadata(valid)).toEqual(valid);
  for (const patch of [
    { operationId: "../other" },
    { metadataEditVersion: -1 },
    { metadataEditVersion: 0.5 },
    { metadataEditVersion: 2147483648 },
    { authors: [""] },
    { language: undefined },
  ])
    expect(readPdfMetadata({ ...valid, ...patch })).toBeNull();
});
