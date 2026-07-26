import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { ReaderStatusPayload } from "@/lib/api-types";
import {
  READER_STATUS_FAILED,
  READER_STATUS_READY,
  READER_STATUS_UNSUPPORTED,
} from "../shared/constants";

export function ReaderStatusState({
  payload,
}: {
  payload: Exclude<ReaderStatusPayload, { status: typeof READER_STATUS_READY }>;
}) {
  const t = useTranslations("reader.status");
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-16 sm:px-8">
      <div className="w-full rounded-4xl bg-surface/95 p-8 shadow-(--shadow-card) backdrop-blur sm:p-10 xl:p-12">
        <p className="font-ui text-[1rem] uppercase tracking-[0.24em] text-title/88 sm:text-[1.12rem]">
          {t("label")}
        </p>
        <h1 className="mt-5 font-reader text-[2.8rem] leading-[0.94] tracking-[-0.04em] text-title sm:text-[4rem]">
          {payload.book.title}
        </h1>
        <p className="mt-6 max-w-2xl font-reader text-[1.18rem] leading-8 text-ink/88 sm:text-[1.45rem] sm:leading-10">
          {payload.message}
        </p>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-5 border-t border-line/45 pt-6">
          <a
            href="/app"
            className="inline-flex min-h-11 items-center rounded-control bg-brand-fill px-5 font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-foreground shadow-(--shadow-card) transition hover:bg-brand-fill-strong"
          >
            {t("backToHome")}
          </a>
          <span
            className={cn(
              "font-ui text-[1.1rem] uppercase tracking-[0.24em] sm:text-[1.35rem]",
              payload.status === READER_STATUS_FAILED
                ? "text-danger"
                : payload.status === READER_STATUS_UNSUPPORTED
                  ? "text-title/82"
                  : "text-ink/60",
            )}
          >
            {payload.status}
          </span>
        </div>
      </div>
    </div>
  );
}
