import { expect, it } from "vitest";
import {
  a,
  b,
  c,
  flushRequests,
  jumpFixture,
} from "./jump-session-test-fixture";

it("an authored note backlink to its initiating caller consumes the return once", async () => {
  const f = jumpFixture();
  const note = { ...c, note: true };
  f.session.jump(note, a);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a]);
  f.session.jump(a, note);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
  const calls = f.navigate.mock.calls.length;
  f.session.back();
  await flushRequests();
  expect(f.navigate).toHaveBeenCalledTimes(calls);
});

it("an authored backlink to another occurrence remains an explicit new destination", async () => {
  const f = jumpFixture();
  const note = { ...c, note: true };
  f.session.jump(note, a);
  await flushRequests();
  f.session.settle(f.intent(), true);
  f.session.jump(b, note);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a, note]);
  expect(f.view.origin).toEqual(b);
});
