import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it } from "vitest";
import { clearWarmCover, rememberCover } from "@/features/offline/buckets/book";
import en from "@/i18n/messages/en.json";
import { ListeningSection } from "./listening-section";

afterEach(clearWarmCover);

it("reuses the listening book's cached artwork before the network resolves", () => {
  rememberCover(
    "listening-book",
    { naturalWidth: 400, naturalHeight: 600 } as HTMLImageElement,
    "blob:cached-listening",
  );
  rememberCover(
    "another-book",
    { naturalWidth: 400, naturalHeight: 600 } as HTMLImageElement,
    "blob:other",
  );
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <ListeningSection
        libraryItemId="listening-book"
        coverImageUrl="/network-cover"
        listening={{
          title: "The Will to Change",
          authorLine: "bell hooks",
          progressPercent: 25,
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(html).toContain('src="blob:cached-listening"');
  expect(html).not.toContain('src="blob:other"');
  expect(html).not.toContain('src="/network-cover"');
});
