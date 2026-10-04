import { expect, it } from "vitest";
import { beginJump, emptyJumpHistory } from "./jump-history";
import { matchesJump } from "./matches-jump";
import { createRestoreIntent } from "./navigation";
import { a, c } from "./jump-session-test-fixture";

it("requires the exact block destination, not a generic opening of that chapter", () => {
  const pending = beginJump(emptyJumpHistory(), a, c).pending;
  const intent = (target: { blockId?: string; textOffset?: number }) =>
    createRestoreIntent(c.chapterId, { ...target, requestId: 1 }, "restore");
  expect(matchesJump(pending, intent({}))).toBe(false);
  expect(
    matchesJump(pending, intent({ blockId: "another", textOffset: 0 })),
  ).toBe(false);
  expect(matchesJump(pending, intent(c))).toBe(true);
});

it("accepts chapter-edge requests only as chapter edges in their own request", () => {
  const pending = beginJump(emptyJumpHistory(), a, {
    ...c,
    blockId: "",
  }).pending;
  const edge = createRestoreIntent(c.chapterId, { requestId: 1 }, "edge");
  const block = createRestoreIntent(
    c.chapterId,
    { ...c, requestId: 1 },
    "block",
  );
  expect(matchesJump(pending, edge)).toBe(true);
  expect(matchesJump(pending, block)).toBe(false);
  expect(matchesJump(pending, { ...edge, requestId: 2 })).toBe(false);
});
