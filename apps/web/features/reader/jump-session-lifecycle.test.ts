import { expect, it } from "vitest";
import {
  a,
  b,
  c,
  flushRequests,
  jumpFixture,
} from "./jump-session-test-fixture";

it("a pending jump cancelled by returning to its origin cannot add a ghost entry", async () => {
  const f = jumpFixture();
  f.session.jump(c);
  const stale = f.intent();
  f.session.jump(a);
  await flushRequests();
  expect(f.navigate).toHaveBeenCalledExactlyOnceWith(a, f.view.state.sequence);
  f.session.settle(stale, true);
  expect(f.view.state.entries).toEqual([]);
  expect(f.session.pending()).toBe(true);
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(a);
  expect(f.view.state.entries).toEqual([]);
});

it("reader exit clears history even when the existing component is activated again", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a]);
  f.session.dispose();
  f.session.activate();
  expect(f.view.state.entries).toEqual([]);
  expect(f.view.error).toBeNull();
  const calls = f.navigate.mock.calls.length;
  f.session.back();
  await flushRequests();
  expect(f.navigate).toHaveBeenCalledTimes(calls);
});

it("an old exit-scope request cannot settle a fresh request with the same target", async () => {
  const f = jumpFixture();
  f.session.jump(c);
  const old = f.intent();
  f.session.dispose();
  f.session.activate();
  f.session.jump(c);
  await flushRequests();
  f.session.settle(old, true);
  expect(f.session.pending()).toBe(true);
  expect(f.view.state.entries).toEqual([]);
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a]);
});
