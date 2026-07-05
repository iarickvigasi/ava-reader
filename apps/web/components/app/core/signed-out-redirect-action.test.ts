import { describe, expect, it } from "vitest";

import { shouldRedirectToSignIn } from "./signed-out-redirect-action";

describe("shouldRedirectToSignIn", () => {
  it("redirects a confirmed signed-out user while online", () => {
    expect(
      shouldRedirectToSignIn({ online: true, isLoaded: true, isSignedIn: false }),
    ).toBe(true);
  });

  it("never redirects offline — login is impossible, cached shell must render", () => {
    expect(
      shouldRedirectToSignIn({ online: false, isLoaded: true, isSignedIn: false }),
    ).toBe(false);
  });

  it("waits for clerk-js to load (unloaded ≠ signed out; offline Clerk never loads)", () => {
    expect(
      shouldRedirectToSignIn({ online: true, isLoaded: false, isSignedIn: undefined }),
    ).toBe(false);
  });

  it("does nothing for a signed-in user", () => {
    expect(
      shouldRedirectToSignIn({ online: true, isLoaded: true, isSignedIn: true }),
    ).toBe(false);
  });

  it("treats an undefined isSignedIn as not-confirmed even when loaded", () => {
    expect(
      shouldRedirectToSignIn({ online: true, isLoaded: true, isSignedIn: undefined }),
    ).toBe(false);
  });
});
