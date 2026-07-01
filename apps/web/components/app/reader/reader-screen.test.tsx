import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReaderUiProvider } from "@/components/app/core/reader-ui-context";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import { withIntl } from "@/lib/test-utils/intl";
import {
  READER_PERSISTENCE_MODE_LOCAL_ONLY,
  READER_STATUS_PROCESSING,
} from "./reader-screen/shared/constants";
import { ReaderScreen } from "./reader-screen";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: async () => "test-token",
    isLoaded: true,
    isSignedIn: true,
  }),
}));

describe("reader screen", () => {
  it("renders non-ready reader state", () => {
    const payload: ReaderStatusPayload = {
      book: {
        authors: [],
        libraryItemId: "library-1",
        primaryFormat: "EPUB",
        slug: "library-1",
        title: "Pending Reader",
      },
      message: "Your book is being processed.",
      progress: {
        chapterLabel: "Chapter 1",
        completionPercent: 0,
        lastReadAt: null,
        locator: null,
      },
      status: READER_STATUS_PROCESSING,
    };

    const markup = renderToStaticMarkup(
      withIntl(
        <ReaderScreen initialPayload={payload} libraryItemId="library-1" />,
      ),
    );

    expect(markup).toContain("Pending Reader");
    expect(markup).toContain("Your book is being processed.");
    expect(markup).toContain(READER_STATUS_PROCESSING);
  });

  it("renders ready reader shell and controls", () => {
    const payload = createReaderResumeFixturePayload();

    const markup = renderToStaticMarkup(
      withIntl(
        <WithReaderUi>
          <ReaderScreen
            initialPayload={payload}
            libraryItemId={payload.book.libraryItemId}
            persistenceMode={READER_PERSISTENCE_MODE_LOCAL_ONLY}
          />
        </WithReaderUi>,
      ),
    );

    expect(markup).toContain("Restoring your last page");
    expect(markup).toContain("0% complete");
    expect(markup).toContain("Page 1 of 1 in chapter");
    expect(markup).toContain("Reader Resume Fixture");
    expect(markup).toContain("Fixture Author");
    expect(markup).toContain("Fixture Chapter 01");
  });
});

function WithReaderUi({ children }: { children: ReactNode }) {
  return <ReaderUiProvider>{children}</ReaderUiProvider>;
}
