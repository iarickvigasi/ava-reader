import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  auth: {
    isLoaded: false,
    isSignedIn: false,
    userId: null as string | null,
    sessionId: null as string | null,
    getToken: vi.fn(),
  },
  review: vi.fn(),
  error: null as string | null,
  serverAuth: vi.fn(() => {
    throw new Error("Server session unavailable");
  }),
  serverRead: vi.fn(() => {
    throw new Error("Server session unavailable");
  }),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => sdk.auth }));
vi.mock("@clerk/nextjs/server", () => ({ auth: sdk.serverAuth }));
vi.mock("@/lib/server-api", () => ({
  fetchServerApiResult: sdk.serverRead,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/admin/pdf-reviews/use-review", () => ({
  useReview: (getToken: typeof sdk.auth.getToken) => {
    sdk.review(getToken);
    return {
      rows: [],
      detail: null,
      busy: false,
      error: sdk.error,
      refresh: vi.fn(),
      select: vi.fn(),
      decide: vi.fn(),
      request: vi.fn(),
    };
  },
}));
import PdfImportReviewsPage from "@/app/app/admin/pdf-imports/page";
import { PdfReviewManager } from "./manager";

beforeEach(() => {
  vi.clearAllMocks();
  sdk.error = null;
  Object.assign(sdk.auth, {
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    sessionId: null,
  });
});

it("renders the review shell while the server session is unavailable without reading private data", () => {
  const markup = renderToStaticMarkup(<PdfImportReviewsPage />);
  expect(markup).toContain("PDF import review");
  expect(markup).toContain("Checking review session");
  expect(sdk.serverAuth).not.toHaveBeenCalled();
  expect(sdk.serverRead).not.toHaveBeenCalled();
  expect(sdk.review).not.toHaveBeenCalled();
});

it.each([
  { isSignedIn: false, userId: null, sessionId: null },
  { isSignedIn: true, userId: null, sessionId: "session" },
  { isSignedIn: true, userId: "operator", sessionId: null },
])("keeps incomplete or signed-out client sessions outside review (%#)", (auth) => {
  Object.assign(sdk.auth, { isLoaded: true, ...auth });
  const markup = renderToStaticMarkup(<PdfReviewManager />);
  expect(markup).toContain("Sign in with your authorized AVA review account");
  expect(markup).not.toContain("No imports awaiting review");
  expect(sdk.review).not.toHaveBeenCalled();
});

it("passes the current client token getter after server-session unavailability", () => {
  Object.assign(sdk.auth, {
    isLoaded: true,
    isSignedIn: true,
    userId: "operator",
    sessionId: "session",
  });
  const markup = renderToStaticMarkup(<PdfImportReviewsPage />);
  expect(markup).toContain("No imports awaiting review");
  expect(sdk.review).toHaveBeenCalledExactlyOnceWith(sdk.auth.getToken);
  expect(sdk.serverAuth).not.toHaveBeenCalled();
  expect(sdk.serverRead).not.toHaveBeenCalled();
});

it("shows an API access refusal without inventing an empty authorized review queue", () => {
  Object.assign(sdk.auth, {
    isLoaded: true,
    isSignedIn: true,
    userId: "operator",
    sessionId: "session",
  });
  sdk.error = "AVA review access is required.";
  const markup = renderToStaticMarkup(<PdfReviewManager />);
  expect(markup).toContain('role="alert"');
  expect(markup).toContain("AVA review access is required");
  expect(markup).not.toContain("No imports awaiting review");
});

it("remounts the review lifetime for every changed client account or session", () => {
  Object.assign(sdk.auth, {
    isLoaded: true,
    isSignedIn: true,
    userId: "operator",
    sessionId: "session-1",
  });
  expect(PdfReviewManager().key).toBe("operator:session-1");
  sdk.auth.sessionId = "session-2";
  expect(PdfReviewManager().key).toBe("operator:session-2");
  sdk.auth.userId = "other";
  expect(PdfReviewManager().key).toBe("other:session-2");
});
