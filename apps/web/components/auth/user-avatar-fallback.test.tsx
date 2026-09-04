import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { UserAvatarFallback } from "./user-avatar-fallback";

const user: CurrentUserPayload = {
  id: "user-1",
  clerkUserId: "clerk-1",
  email: "ada@example.com",
  displayName: "Ada Reader",
  avatarUrl: "https://img.clerk.com/ada.jpg",
  role: "USER",
};

describe("UserAvatarFallback", () => {
  it("holds a fixed-size slot with no user at all", () => {
    const markup = renderToStaticMarkup(<UserAvatarFallback currentUser={null} />);

    expect(markup).toContain("size-8");
    expect(markup).not.toContain("<img");
  });

  it("shows the display name's initial before the cache check resolves", () => {
    const markup = renderToStaticMarkup(<UserAvatarFallback currentUser={user} />);

    expect(markup).toContain(">A<");
    expect(markup).not.toContain("<img");
  });

  it("falls back to the email's initial with no display name", () => {
    const markup = renderToStaticMarkup(
      <UserAvatarFallback currentUser={{ ...user, displayName: null }} />,
    );

    expect(markup).toContain(">A<");
  });
});
