import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitAppToast } from "@/components/app/core/app-toast";
import { setBookFinishedAt } from "@/features/offline/buckets/library";
import enMessages from "@/i18n/messages/en.json";
import { withIntl } from "@/lib/test-utils/intl";

import { ActionCard } from "./action-card";
import { FinishedDateCard } from "./finished-date-card";

const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(async () => "token"),
}));

vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({ getToken }),
}));
vi.mock("@/components/app/core/app-toast", () => ({ emitAppToast: vi.fn() }));
vi.mock("@/features/offline/buckets/library", () => ({
  setBookFinishedAt: vi.fn(async () => undefined),
  subscribeToFinishDateSyncFailures: vi.fn(() => vi.fn()),
}));

// Preserve the actual button markup and capture its handler to exercise writes
// in the repository's Node-only component test environment.
vi.mock("./action-card", async (importOriginal) => {
  const original = await importOriginal<typeof import("./action-card")>();
  return { ...original, ActionCard: vi.fn(original.ActionCard) };
});

function renderCard(finishedAt: string | null = null) {
  return renderToStaticMarkup(
    withIntl(
      <FinishedDateCard finishedAt={finishedAt} libraryItemId="library-42" />,
    ),
  );
}

async function clickCard(): Promise<void> {
  const props = vi.mocked(ActionCard).mock.calls.at(-1)?.[0];
  if (!props?.onClick) throw new Error("Finish date card has no click handler");
  return props.onClick();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setBookFinishedAt).mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T12:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("FinishedDateCard", () => {
  it("renders an accessible button with the agreed save copy", () => {
    const html = renderCard();
    expect(html).toContain('<button type="button"');
    expect(html).toContain("Mark as finished");
    expect(html).toContain("Tap to save today’s date");
    expect(html).not.toContain("100%");
  });

  it("records the tap timestamp through the separate finish-date operation", async () => {
    renderCard();
    await clickCard();
    expect(setBookFinishedAt).toHaveBeenCalledExactlyOnceWith(
      "library-42",
      "2026-09-13T12:00:00.000Z",
      getToken,
    );
    expect(emitAppToast).not.toHaveBeenCalled();
  });

  it("shows the saved date and removes it with null", async () => {
    const html = renderCard("2026-09-12T12:00:00.000Z");
    expect(html).toContain("Finished on Sep 12, 2026");
    expect(html).toContain("Tap to remove finish date");
    await clickCard();
    expect(setBookFinishedAt).toHaveBeenCalledExactlyOnceWith(
      "library-42",
      null,
      getToken,
    );
  });

  it("formats the finish date with the current locale", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="de" messages={enMessages}>
        <FinishedDateCard
          finishedAt="2026-09-12T12:00:00.000Z"
          libraryItemId="library-42"
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Finished on 12. Sept. 2026");
  });

  it("ignores repeated taps until the local write completes", async () => {
    let complete!: () => void;
    vi.mocked(setBookFinishedAt).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    renderCard();
    const firstTap = clickCard();
    await clickCard();
    expect(setBookFinishedAt).toHaveBeenCalledTimes(1);
    complete();
    await firstTap;
  });

  it("reports local persistence errors and permits retry", async () => {
    vi.mocked(setBookFinishedAt).mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );
    renderCard();
    await clickCard();
    expect(emitAppToast).toHaveBeenCalledExactlyOnceWith({
      message: "Your finish date change couldn’t be saved. Please try again.",
      tone: "error",
    });
    await clickCard();
    expect(setBookFinishedAt).toHaveBeenCalledTimes(2);
  });
});
