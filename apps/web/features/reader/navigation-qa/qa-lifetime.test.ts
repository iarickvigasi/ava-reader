import { expect, it } from "vitest";
import { c, flushRequests } from "../jump-session-test-fixture";
import { qaFixture } from "./qa-test-fixture";
it("mutations require the exact reader-lifetime nonce; snapshot can bootstrap it", () => {
  const f = qaFixture();
  const scope = f.acks[0]!.scope;
  const bootstrap = {
    libraryItemId: scope.libraryItemId,
    finalContentId: scope.finalContentId,
    readerFingerprint: scope.readerFingerprint,
  };
  f.command("arm-fail", { scope: bootstrap, stage: "navigate", target: c });
  expect(f.acks.at(-1)).toMatchObject({ ok: false, reason: "Scope mismatch." });
  f.command("snapshot", { scope: bootstrap });
  expect(f.acks.at(-1)).toMatchObject({
    ok: true,
    phase: "snapshot",
    scope: { accountScope: f.acks[0]!.scope.accountScope },
  });
});
it("a prior lifetime command cannot arm or cancel a remounted same-book reader", async () => {
  const old = qaFixture();
  const priorScope = old.acks[0]!.scope;
  old.session.dispose();
  old.disconnect();
  const fresh = qaFixture();
  fresh.session.jump(c);
  await flushRequests();
  const sequence = fresh.view.state.sequence;
  fresh.command("cancel", { scope: priorScope });
  expect(fresh.acks.at(-1)).toMatchObject({
    ok: false,
    reason: "Scope mismatch.",
  });
  expect(fresh.view.state.sequence).toBe(sequence);
  expect(fresh.view.state.pending?.destination).toEqual(c);
});
