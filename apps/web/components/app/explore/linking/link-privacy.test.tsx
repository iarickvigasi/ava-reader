import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import uk from "@/i18n/messages/uk.json";
import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LinkPrivateCopy } from "./link-private-copy";
import { PrivateCopyLink } from "./private-copy-link";
vi.mock("@/features/offline/buckets/library", () => ({
  useWorkCopies: () => [],
}));
vi.mock("@/features/explore/linking/use-private-copy-link", () => ({
  usePrivateCopyLink: () => ({
    link: null,
    pending: false,
    error: "",
    action: null,
    setAction: vi.fn(),
  }),
}));
it("labels the owner’s private linking controls on both entry points", () => {
  expect(
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <LinkPrivateCopy
          work={{ id: "work" } as Parameters<typeof LinkPrivateCopy>[0]["work"]}
        />
      </NextIntlClientProvider>,
    ),
  ).toContain("Link is visible to you only");
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <PrivateCopyLink libraryItemId="copy" />
    </NextIntlClientProvider>,
  );
  expect(html).toContain("Link to catalog");
  expect(html).toMatch(
    /<button[^>]*>[\s\S]*Link is visible to you only[\s\S]*<\/button>/,
  );
  expect(html).not.toContain(
    '<p class="text-sm text-muted">Visible to you only</p>',
  );
});

it("localizes the private link action and its privacy caption in Ukrainian", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="uk" messages={uk}>
      <PrivateCopyLink libraryItemId="copy" />
    </NextIntlClientProvider>,
  );
  expect(html).toContain("Пов’язати з каталогом");
  expect(html).toContain("Цей зв’язок бачите лише ви");
  expect(html).not.toContain("Link to catalog");
});
