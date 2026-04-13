import { describe, expect, it } from "vitest";
import { READER_STATUS_READY } from "../../shared/constants";
import { createReaderResumeFixturePayload } from "@/lib/reader-test-fixture";
import { resolveInitialResumeDestination } from "./use-reader-resume-bootstrap.helpers";

describe("reader resume bootstrap helpers", () => {
  it("prefers the resume snapshot locator destination when available", () => {
    const payload = getReadyFixturePayload();

    expect(
      resolveInitialResumeDestination({
        payload,
        snapshot: {
          locator: {
            blockId: "chapter-3::paragraph-2",
            chapterId: "chapter-3",
            textOffset: 18,
          },
          savedAt: "2026-04-12T12:00:00.000Z",
          version: 2,
        },
      }),
    ).toEqual({
      target: {
        blockId: "chapter-3::paragraph-2",
        textOffset: 18,
      },
      targetChapterId: "chapter-3",
    });
  });

  it("falls back to the payload active chapter when no snapshot exists", () => {
    const payload = getReadyFixturePayload();

    expect(
      resolveInitialResumeDestination({
        payload,
        snapshot: null,
      }),
    ).toEqual({
      target: { edge: "start" },
      targetChapterId: payload.activeChapterId,
    });
  });
});

function getReadyFixturePayload() {
  const payload = createReaderResumeFixturePayload();

  if (payload.status !== READER_STATUS_READY) {
    throw new Error("Expected READY fixture payload.");
  }

  return payload;
}
