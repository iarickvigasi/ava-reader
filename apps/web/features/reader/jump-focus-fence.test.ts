import { expect, it } from "vitest";
import { b, c, flushRequests, jumpFixture } from "./jump-session-test-fixture";
it("deferred focus is fenced by the exact settled request and reader lifetime", async () => {
  const f = jumpFixture();
  f.session.jump(b);
  await flushRequests();
  f.session.settle(f.intent(), true);
  const old = f.focus.mock.calls.at(-1)![1] as () => boolean;
  expect(old()).toBe(true);
  f.session.jump(c);
  expect(old()).toBe(false);
  await flushRequests();
  f.session.settle(f.intent(), true);
  const current = f.focus.mock.calls.at(-1)![1] as () => boolean;
  expect(current()).toBe(true);
  expect(old()).toBe(false);
  f.session.dispose();
  expect(current()).toBe(false);
});
