import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { AppNavigation } from "./app-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/explore/books/work",
}));
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button>Theme</button>,
}));
vi.mock("@/components/auth/clerk-user-button", () => ({
  UserMenuButton: () => {
    throw new Error("Account controls must stay gated");
  },
}));
vi.mock("./header-status-chip", () => ({
  HeaderStatusChip: () => {
    throw new Error("Account sync status must stay gated");
  },
}));

it("renders usable public navigation before account consumers are allowed to mount", () => {
  const html = renderToStaticMarkup(
    withIntl(<AppNavigation currentUser={null} startup />),
  );
  for (const href of ["/app", "/app/library", "/app/explore", "/app/connect"])
    expect(html).toContain(`href="${href}"`);
  expect(html).toContain("<header");
  expect(html).toContain("Theme");
  expect(html).not.toContain("/app/admin/catalog");
});
