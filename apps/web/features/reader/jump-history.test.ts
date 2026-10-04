import { describe, expect, it } from "vitest";
import { beginJump, emptyJumpHistory, finishJump } from "./jump-history";
const a = { chapterId: "one", blockId: "body", textOffset: 3 };
const b = { chapterId: "four", blockId: "note", textOffset: 0 };
const c = { chapterId: "two", blockId: "section", textOffset: 11 };

describe("session jump history", () => {
  it("commits A→B→C and consumes Back B→A only on successful restore", () => {
    let state = beginJump(emptyJumpHistory(), a, b);
    expect(state.entries).toEqual([]);
    state = finishJump(state, state.sequence, true);
    state = beginJump(state, b, c);
    state = finishJump(state, state.sequence, true);
    expect(state.entries).toEqual([a, b]);
    state = beginJump(state, c, b, true);
    state = finishJump(state, state.sequence, false);
    expect(state.entries).toEqual([a, b]);
    state = beginJump(state, c, b, true);
    state = finishJump(state, state.sequence, true);
    state = beginJump(state, b, a, true);
    state = finishJump(state, state.sequence, true);
    expect(state.entries).toEqual([]);
  });
  it("ignores stale completion, failure and same-place jumps", () => {
    let state = beginJump(emptyJumpHistory(), a, b);
    const stale = state.sequence;
    state = beginJump(state, a, c);
    expect(finishJump(state, stale, true)).toBe(state);
    state = finishJump(state, state.sequence, false);
    state = beginJump(state, a, a);
    expect(state.pending).toBeNull();
    expect(state.entries).toEqual([]);
  });
  it("new account/book/content sessions start empty", () => {
    const prior = finishJump(beginJump(emptyJumpHistory(), a, b), 1, true);
    expect(prior.entries).toEqual([a]);
    expect(emptyJumpHistory()).toEqual({
      entries: [],
      entryScopes: [],
      pending: null,
      sequence: 0,
    });
  });
});
