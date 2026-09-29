import { expect, it } from "vitest";
import {
  a,
  b,
  c,
  flushRequests,
  jumpFixture,
} from "./jump-session-test-fixture";
it("reports failed origin restoration truthfully and retains the existing stack", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  f.session.settle(f.intent(), true);
  f.session.jump(c);
  await flushRequests();
  f.session.settle(f.intent(), false);
  await flushRequests();
  f.session.settle(f.intent(), false);
  expect(f.view.error).toBe("Your previous passage could not be restored.");
  expect(f.view.state.entries).toEqual([a]);
  expect(f.view.origin).toBeNull();
  expect(f.session.pending()).toBe(false);
});
it("restores after a rejected navigation and never starts queued work after session disposal", async () => {
  const f = jumpFixture();
  f.navigate.mockRejectedValueOnce(new Error("target unavailable"));
  f.session.jump(c);
  await flushRequests();
  expect(f.view.state.pending?.destination).toEqual(a);
  expect(f.navigate).toHaveBeenCalledTimes(2);
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([]);
  f.session.jump(b);
  f.session.dispose();
  await flushRequests();
  expect(f.navigate).toHaveBeenCalledTimes(2);
});
it("superseded target cannot settle or replace the original origin", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  const stale = f.intent();
  f.view.origin = b;
  f.session.jump(c);
  await flushRequests();
  f.session.settle(stale, true);
  expect(f.session.pending()).toBe(true);
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a]);
});
