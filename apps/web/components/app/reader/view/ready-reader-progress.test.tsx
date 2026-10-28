import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import { withIntl } from "@/lib/test-utils/intl";
import { ReadyReaderProgress } from "./ready-reader-progress";

const device = vi.hoisted(() => ({ isPhone: false }));
vi.mock("@/components/app/core/reader-ui-context", () => ({
  useReaderUi: () => device,
}));
const payload = createReaderResumeFixturePayload();
if (payload.status !== "READY") throw new Error("Expected ready fixture");
const chapter = payload.chapters[0];

function render(input: {
  page?: number;
  count?: number;
  previous?: string | null;
  next?: string | null;
  disabled?: boolean;
}) {
  return renderToStaticMarkup(
    withIntl(
      <ReadyReaderProgress
        completionPercent={0}
        currentPageIndex={input.page ?? 0}
        pageCount={input.count ?? 3}
        activeChapter={{
          ...chapter,
          previousChapterId: input.previous ?? null,
          nextChapterId: input.next ?? null,
        }}
        disabled={input.disabled ?? false}
        goToNextPage={vi.fn()}
        goToPreviousPage={vi.fn()}
      />,
    ),
  );
}

describe("reader page controls", () => {
  it("hides only the direction past the book boundary", () => {
    expect(render({})).not.toContain("Previous");
    expect(render({})).toContain("Next");
    expect(render({ page: 2 })).toContain("Previous");
    expect(render({ page: 2 })).not.toContain("Next");
    expect(render({ count: 1 })).not.toContain("<button");
  });

  it("keeps both directions inside the book, including chapter crossings", () => {
    expect(render({ page: 1 }).match(/<button/g)).toHaveLength(2);
    expect(
      render({ count: 1, previous: "before", next: "after" }).match(/<button/g),
    ).toHaveLength(2);
  });

  it("disables available controls during loading, restoration, or a panel", () => {
    expect(
      render({ page: 1, disabled: true }).match(/disabled=""/g),
    ).toHaveLength(2);
  });

  it("retains phone navigation without adding buttons", () => {
    device.isPhone = true;
    expect(render({ page: 1 })).not.toContain("<button");
    device.isPhone = false;
  });
});
