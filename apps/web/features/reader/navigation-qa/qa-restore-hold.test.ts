import { expect, it } from "vitest";
import { a, b, flushRequests } from "../jump-session-test-fixture";
import { qaFixture } from "./qa-test-fixture";
it("remeasurement updates held restoration without bypass or duplicate commit", async () => {
  const f = qaFixture();
  f.command("arm-hold", { stage: "restore", target: b });
  f.session.jump(b);
  await flushRequests();
  f.qa.settle(f.intent(), false);
  await flushRequests();
  expect(f.view.state.entries).toEqual([]);
  expect(f.session.pending()).toBe(true);
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.state.entries).toEqual([]);
  f.command("release");
  await flushRequests();
  expect(f.view.origin).toEqual(b);
  expect(f.view.state.entries).toEqual([a]);
  expect(
    f.acks
      .filter((ack) => ack.phase === "restore-observed")
      .map((ack) => ack.actualRestoreSuccess),
  ).toEqual([false, true]);
});
it("failed Back keeps its valid entry for a later successful retry", async () => {
  const f = qaFixture();
  f.session.jump(b);
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  f.command("arm-fail", { stage: "restore", target: a });
  f.session.back();
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.state.entries).toEqual([a]);
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.origin).toEqual(b);
  f.session.back();
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
});

it("cancel also invalidates an already pending origin rollback", async () => {
  const f = qaFixture();
  f.command("arm-fail", { stage: "restore", target: b });
  f.session.jump(b);
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  const old = f.intent();
  const sequence = f.view.state.sequence;
  f.command("arm-hold", { stage: "restore", target: a });
  f.qa.settle(old, true);
  await flushRequests();
  f.command("cancel");
  await flushRequests();
  expect(f.view.state.sequence).toBeGreaterThan(sequence);
  expect(f.session.pending()).toBe(true);
  f.qa.settle(old, true);
  await flushRequests();
  expect(f.session.pending()).toBe(true);
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
});
