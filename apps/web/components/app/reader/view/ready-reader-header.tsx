"use client";

import Link from "next/link";
import { getLibraryBookInfoHref } from "@/lib/app-routes";
import { cn } from "@/lib/cn";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { HeaderStatusChip } from "@/components/app/core/header-status-chip";
import type { ReadyReaderPayload } from "../shared/types";
import { formatReaderHeaderParts } from "../shared/format-reader-header-parts";

import { MobileReaderHeaderText } from "./mobile-reader-header-text";

export function ReadyReaderHeader({
  activeChapter,
  payload,
  compact = false,
}: {
  compact?: boolean;
  activeChapter: ReaderChapterPayload;
  payload: ReadyReaderPayload;
}) {
  const { title, author, chapter } = formatReaderHeaderParts(
    payload,
    activeChapter,
  );

  const bookLabel = [title, author].filter(Boolean).join(", ");

  return (
    <header
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        !compact && "sm:gap-3 sm:pt-1",
      )}
    >
      <Link
        href={getLibraryBookInfoHref(payload.book.slug)}
        aria-label={compact ? bookLabel : undefined}
        className="min-w-0 flex-1 rounded-control transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-fill"
      >
        <h1
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1 font-sans text-[0.65rem] font-bold uppercase leading-[1.35] tracking-[0.12em] text-muted",
            !compact && "sm:text-xs sm:tracking-[0.24em] md:min-h-9",
          )}
        >
          {compact ? (
            <MobileReaderHeaderText
              key={payload.book.slug}
              title={title}
              author={author}
              chapter={chapter}
            />
          ) : (
            <>
              <span
                className={cn(
                  "min-w-0 truncate max-w-[25ch]",
                  !compact && "md:max-w-[75ch]",
                )}
              >
                {title}
              </span>

              <span className="shrink-0">,</span>

              <span className="min-w-0 truncate">{author}</span>

              <span className="shrink-0">–</span>

              <span className="min-w-0 truncate" title={chapter}>
                {chapter}
              </span>
            </>
          )}
        </h1>
      </Link>
      <div className={cn("hidden shrink-0", !compact && "md:flex")}>
        <HeaderStatusChip />
      </div>
    </header>
  );
}
