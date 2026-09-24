import { expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => authenticate,
}));
import proxy from "./proxy";
const event = {} as NextFetchEvent;
it("serves app shells when Clerk attempts a handshake redirect", async () => {
  authenticate.mockResolvedValue(
    Response.redirect("https://clerk.example.com/handshake"),
  );
  const response = await proxy(
    new NextRequest("https://example.com/app/read/book"),
    event,
  );
  expect(response?.status).toBe(200);
  expect(response?.headers.get("location")).toBeNull();
});
it("serves app shells during provider failure", async () => {
  authenticate.mockRejectedValue(new Error("unreachable"));
  expect(
    (await proxy(new NextRequest("https://example.com/app"), event))?.status,
  ).toBe(200);
});
it("preserves auth redirects outside app shells", async () => {
  authenticate.mockResolvedValue(
    Response.redirect("https://clerk.example.com/handshake"),
  );
  expect(
    (await proxy(new NextRequest("https://example.com/sign-in"), event))
      ?.status,
  ).toBe(302);
});
