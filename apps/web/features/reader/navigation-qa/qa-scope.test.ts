import { expect, it } from "vitest";
import { a, b, c, flushRequests } from "../jump-session-test-fixture";
import { qaFixture } from "./qa-test-fixture";
it.each([
  "finalContentId",
  "libraryItemId",
  "readerFingerprint",
  "accountScope",
] as const)(
  "actual Back refuses a foreign %s stamp while preserving previous valid history",
  async (key) => {
    const f = qaFixture();
    f.session.jump(b);
    await flushRequests();
    f.qa.settle(f.intent(), true);
    await flushRequests();
    const originalEntries = f.view.state.entries;
    const originalScopes = f.view.state.entryScopes;
    f.command("inject-stale", {
      target: c,
      entryScope: { ...f.acks[0]!.scope, [key]: "foreign" },
    });
    expect(f.view.state.entries).toEqual([a, c]);
    const calls = f.navigate.mock.calls.length;
    f.session.back();
    await flushRequests();
    expect(f.navigate).toHaveBeenCalledTimes(calls);
    expect(f.view.origin).toEqual(b);
    expect(f.view.error).toContain("another reading session");
    expect(f.view.state.entries).toEqual([a]);
    expect(originalEntries).toEqual([a]);
    expect(originalScopes).toHaveLength(1);
    f.session.back();
    await flushRequests();
    f.qa.settle(f.intent(), true);
    await flushRequests();
    expect(f.view.origin).toEqual(a);
    expect(f.view.state.entries).toEqual([]);
  },
);
it("wrong scope and malformed commands cannot arm or mutate a reader", async () => {
  const f = qaFixture();
  f.command("arm-fail", {
    stage: "navigate",
    target: c,
    scope: { ...f.acks[0]!.scope, finalContentId: "foreign" },
  });
  expect(f.acks.at(-1)).toMatchObject({
    ok: false,
    phase: "rejected",
    reason: "Scope mismatch.",
  });
  f.qa.receive({ type: "command", commandId: "malformed", action: "arm-hold" });
  expect(f.acks.at(-1)).toMatchObject({ ok: false, commandId: "malformed" });
  f.session.jump(c);
  await flushRequests();
  expect(f.navigate).toHaveBeenCalledExactlyOnceWith(c, 1);
  expect(JSON.stringify(f.acks)).not.toContain("private-account");
});
it("ACK snapshots are copies and cannot rewrite session history", async () => {
  const f = qaFixture();
  f.session.jump(b);
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  const ack = f.acks.at(-1)!;
  ack.history[0]!.textOffset = 999;
  ack.loadedChapterIds.push("not-loaded");
  f.command("snapshot");
  expect(f.acks.at(-1)!.history).toEqual([a]);
  expect(f.acks.at(-1)!.loadedChapterIds).toEqual(["one", "four"]);
});
