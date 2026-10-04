import { expect, it } from "vitest";
import { a, b, c, flushRequests } from "../jump-session-test-fixture";
import { qaFixture } from "./qa-test-fixture";
it("an exact one-shot navigate failure rolls back without history and can retry", async () => {
  const f = qaFixture();
  const arm = f.command("arm-fail", { stage: "navigate", target: c });
  expect(f.acks.at(-1)).toMatchObject({
    commandId: arm.commandId,
    phase: "armed",
    ok: true,
  });
  f.session.jump(c);
  await flushRequests();
  expect(f.navigate.mock.calls.map(([point]) => point)).toEqual([a]);
  expect(f.view.state.entries).toEqual([]);
  expect(f.acks.find((ack) => ack.phase === "fault")).toMatchObject({
    commandId: arm.commandId,
    target: c,
    sequence: 1,
  });
  f.qa.settle(f.intent(), true);
  await flushRequests();
  f.session.jump(c);
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.origin).toEqual(c);
  expect(f.view.state.entries).toEqual([a]);
});
it("actual measured restoration is observed separately from injected restore failure", async () => {
  const f = qaFixture();
  f.command("arm-fail", { stage: "restore", target: b });
  f.session.jump(b);
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.acks.find((ack) => ack.phase === "restore-observed")).toMatchObject({
    actualRestoreSuccess: true,
  });
  expect(f.view.state.pending).toMatchObject({
    rollback: true,
    destination: a,
  });
  expect(f.view.state.entries).toEqual([]);
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
});
it("an exact fail does not intercept an unrelated target", async () => {
  const f = qaFixture();
  f.command("arm-fail", { stage: "navigate", target: c });
  f.session.jump(b);
  await flushRequests();
  f.qa.settle(f.intent(), true);
  await flushRequests();
  expect(f.view.state.entries).toEqual([a]);
  expect(f.acks.some((ack) => ack.phase === "fault")).toBe(false);
  f.session.jump(c);
  await flushRequests();
  expect(f.view.state.entries).toEqual([a]);
  expect(f.view.state.pending?.rollback).toBe(true);
});
