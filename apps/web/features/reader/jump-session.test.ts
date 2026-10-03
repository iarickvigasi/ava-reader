import { expect, it } from "vitest";
import {
  a,
  b,
  c,
  flushRequests,
  jumpFixture,
} from "./jump-session-test-fixture";
it("runs text → same-chapter figure → cold chapter → Back twice; same-place does not navigate", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  expect(f.view.state.entries).toEqual([]);
  f.session.settle(f.intent(), true);
  const calls = f.navigate.mock.calls.length;
  f.session.jump(b);
  await flushRequests();
  expect(f.navigate).toHaveBeenCalledTimes(calls);
  expect(f.focus).toHaveBeenLastCalledWith(b);
  expect(f.session.pending()).toBe(false);
  expect(f.view.state.entries).toEqual([a]);
  f.session.jump(c);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a, b]);
  f.session.back();
  await flushRequests();
  expect(f.view.state.entries).toEqual([a, b]);
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(b);
  f.session.back();
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
  expect(f.focus.mock.calls.map(([target]) => target)).toEqual([b, b, c, b, a]);
});
it("keeps failure pending until exact origin restoration and rejects stale target settlement", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  const failed = f.intent();
  f.session.settle(failed, false);
  await flushRequests();
  expect(f.session.pending()).toBe(true);
  expect(f.view.state.pending?.destination).toEqual(a);
  expect(f.view.error).toContain("Returning");
  expect(f.view.error).not.toContain("kept");
  f.session.settle(failed, true);
  expect(f.session.pending()).toBe(true);
  f.session.settle(f.intent(), true);
  expect(f.session.pending()).toBe(false);
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
  expect(f.view.error).toContain("has been restored");
});
it("does not consume Back on failure and permits the same return after recovery", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  f.session.settle(f.intent(), true);
  f.session.back();
  await flushRequests();
  f.session.settle(f.intent(), false);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(b);
  expect(f.view.state.entries).toEqual([a]);
  f.session.back();
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
});
