import { expect, it } from "vitest";
import { resolveAuthState } from "./auth-state";
it("does not treat initialization, outages, or offline state as confirmed expiry", () => {
  expect(
    resolveAuthState({ online: true, loaded: false, signedIn: false }),
  ).toBe("restoring");
  expect(
    resolveAuthState({
      online: true,
      loaded: true,
      status: "error",
      signedIn: false,
    }),
  ).toBe("unavailable");
  expect(
    resolveAuthState({ online: false, loaded: true, signedIn: false }),
  ).toBe("unavailable");
  expect(
    resolveAuthState({ online: true, loaded: true, signedIn: false }),
  ).toBe("sign-in-required");
  expect(resolveAuthState({ online: true, loaded: true, signedIn: true })).toBe(
    "authenticated",
  );
});
