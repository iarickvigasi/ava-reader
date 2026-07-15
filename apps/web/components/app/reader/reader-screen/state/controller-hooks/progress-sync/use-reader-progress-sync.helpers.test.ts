import { describe, expect, it } from "vitest";
import {
  evaluatePersistEligibility,
  shouldClearPendingAfterAck,
  shouldFlushPendingProgress,
} from "./use-reader-progress-sync.helpers";

describe("reader progress sync helpers", () => {
  it("treats a new locator key as persistable", () => {
    expect(
      evaluatePersistEligibility({
        lastServerAckKey: "chapter-1:b1:10",
        locatorKey: "chapter-1:b2:0",
        pendingServerLocatorKey: "chapter-1:b2:0",
      }),
    ).toEqual({
      shouldClearPending: false,
      shouldPersist: true,
    });
  });

  it("skips persistence and clears pending when locator is already acknowledged", () => {
    expect(
      evaluatePersistEligibility({
        lastServerAckKey: "chapter-1:b2:0",
        locatorKey: "chapter-1:b2:0",
        pendingServerLocatorKey: "chapter-1:b2:0",
      }),
    ).toEqual({
      shouldClearPending: true,
      shouldPersist: false,
    });
  });

  it("detects pending-key clearing after server acknowledgment", () => {
    expect(
      shouldClearPendingAfterAck({
        ackKey: "chapter-2:b4:6",
        pendingServerLocatorKey: "chapter-2:b4:6",
      }),
    ).toBe(true);
    expect(
      shouldClearPendingAfterAck({
        ackKey: "chapter-2:b4:6",
        pendingServerLocatorKey: "chapter-2:b4:7",
      }),
    ).toBe(false);
  });

  it("flushes only when there is a pending locator not yet acknowledged", () => {
    expect(
      shouldFlushPendingProgress({
        lastServerAckKey: "chapter-1:b1:0",
        pendingLocatorExists: true,
        pendingServerLocatorKey: "chapter-1:b2:1",
      }),
    ).toBe(true);
    expect(
      shouldFlushPendingProgress({
        lastServerAckKey: "chapter-1:b2:1",
        pendingLocatorExists: true,
        pendingServerLocatorKey: "chapter-1:b2:1",
      }),
    ).toBe(false);
    expect(
      shouldFlushPendingProgress({
        lastServerAckKey: "chapter-1:b2:1",
        pendingLocatorExists: false,
        pendingServerLocatorKey: "chapter-1:b3:0",
      }),
    ).toBe(false);
  });
});
