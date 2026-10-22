import { expect, it } from "vitest";
import { offlineLoginDestination } from "./offline-login-destination";
it("opens cached reading only for a remembered, locally signed-in account offline", () => {
  expect(
    offlineLoginDestination({
      online: false,
      owner: "reader",
      signedOut: false,
    }),
  ).toBe("/app");
  expect(
    offlineLoginDestination({ online: false, owner: null, signedOut: false }),
  ).toBeNull();
  expect(
    offlineLoginDestination({
      online: false,
      owner: "reader",
      signedOut: true,
    }),
  ).toBeNull();
  expect(
    offlineLoginDestination({
      online: true,
      owner: "reader",
      signedOut: false,
    }),
  ).toBeNull();
});
