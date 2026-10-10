import { expect, it } from "vitest";
import {
  a,
  b,
  c,
  flushRequests,
  jumpFixture,
} from "./jump-session-test-fixture";

it("captures the loaded first leaf after a cold chapter-start before the next jump", async () => {
  const f = jumpFixture();
  const edge = { ...c, blockId: "" };
  const resolved = { ...c, blockId: "first-loaded-paragraph" };
  f.session.update({
    origin: () => f.view.origin,
    navigate: f.navigate,
    resolve: (target) => (target.blockId ? target : resolved),
    arrive: (target) => {
      f.view.origin = target;
    },
    focus: f.focus,
    leave: () => {
      f.view.origin = null;
    },
    publish: (state, error) => {
      f.view.state = state;
      f.view.error = error;
    },
  });
  f.session.jump(edge);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.origin).toEqual(resolved);
  expect(f.focus).toHaveBeenLastCalledWith(resolved, expect.any(Function));
  f.session.jump(b);
  await flushRequests();
  f.session.settle(f.intent(), true);
  expect(f.view.state.entries).toEqual([a, resolved]);
  f.session.back();
  await flushRequests();
  expect(f.navigate).toHaveBeenLastCalledWith(resolved, f.view.state.sequence);
});
