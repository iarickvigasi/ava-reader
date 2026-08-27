import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { withIntl } from "@/lib/test-utils/intl";

import { ImportButton } from "./import-button";

// ImportButton reads auth for the upload and the router for the post-upload
// refresh; static markup mounts neither provider, so both are mocked.
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: async () => "test-token",
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("ImportButton", () => {
  it("mounts the Uploading pending label alongside the idle label", () => {
    const markup = renderToStaticMarkup(withIntl(<ImportButton />));

    expect(markup).toContain("Import book");
    expect(markup).toContain("Uploading");
    expect(markup).not.toContain("Uploading...");
  });
});
