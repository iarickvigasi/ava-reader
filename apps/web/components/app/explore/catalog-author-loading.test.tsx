import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import AuthorLoading from "@/app/app/explore/authors/[authorId]/loading";

// During navigation the parent fallback can still observe the previous path.
vi.mock("next/navigation", () => ({ usePathname: () => "/app/explore" }));

it("renders the author skeleton independently of the previous Explore route and account providers", () => {
  const html = renderToStaticMarkup(<AuthorLoading />);
  expect(html).toContain('aria-label="Loading author details"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("animate-pulse");
  expect(html).not.toContain("<input");
});
