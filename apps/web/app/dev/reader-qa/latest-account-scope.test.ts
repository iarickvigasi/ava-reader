import { expect, it } from "vitest";
import { latestAccountScope } from "./latest-account-scope";
const scope = {
  libraryItemId: "item",
  finalContentId: "fixed",
  readerFingerprint: "build",
};
const ack = (accountScope: string, change = {}) => ({
  type: "ack",
  ok: true,
  scope: { ...scope, accountScope, ...change },
});
it("uses the latest acknowledged lifetime of the exact book and build", () => {
  expect(
    latestAccountScope(
      [ack("old"), ack("current"), ack("foreign", { finalContentId: "other" })],
      scope,
    ),
  ).toBe("current");
});
it("requires an actual successful scoped acknowledgement", () => {
  expect(
    latestAccountScope(
      [
        { sent: { scope } },
        { ...ack("bad"), ok: false },
        { type: "ack", ok: true, scope },
      ],
      scope,
    ),
  ).toBeNull();
});
it("does not use an acknowledgement belonging to another book or build", () => {
  expect(
    latestAccountScope(
      [
        ack("a", { libraryItemId: "other" }),
        ack("b", { readerFingerprint: "other" }),
      ],
      scope,
    ),
  ).toBeNull();
});
