import { describe, expect, it } from "vitest";
import { buildGenerateIntent } from "./build-generate-intent";

const QUEUED_AT = "2026-08-19T00:00:00.000Z";
const CONTEXT_FIELDS = {
  context: "Darcy walked off. Elizabeth remained.",
  bookTitle: "Pride and Prejudice",
  author: "Jane Austen",
};

describe("buildGenerateIntent", () => {
  it("passes the selection context fields through to the translate intent", () => {
    const intent = buildGenerateIntent(
      {
        kind: "translate",
        text: "cordial",
        targetLang: "French",
        ...CONTEXT_FIELDS,
      },
      "id-1",
      QUEUED_AT,
    );

    expect(intent.payload).toMatchObject(CONTEXT_FIELDS);
  });

  it("passes the selection context fields through to the etymology intent", () => {
    const intent = buildGenerateIntent(
      { kind: "etymology", text: "cordial", ...CONTEXT_FIELDS },
      "id-2",
      QUEUED_AT,
    );

    expect(intent.payload).toMatchObject(CONTEXT_FIELDS);
  });

  it("passes the selection context fields through to the explain intent", () => {
    const intent = buildGenerateIntent(
      { kind: "explain", text: "cordial", ...CONTEXT_FIELDS },
      "id-3",
      QUEUED_AT,
    );

    expect(intent.payload).toMatchObject(CONTEXT_FIELDS);
  });
});
