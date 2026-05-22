import Link from "next/link";
import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";

type CurrentEngagement = NonNullable<HomePayload["currentEngagement"]>;

const RAIL_MIN_PERCENT = 2;

export function EngagementCover({
  engagement,
  readerHref,
}: {
  engagement: CurrentEngagement;
  readerHref: string;
}) {
  const railHeightPercent = Math.min(
    Math.max(engagement.completionPercent, RAIL_MIN_PERCENT),
    100,
  );

  return (
    <div className="relative hidden md:block">
      <div className="absolute bottom-0 left-full top-0 ml-4 w-0.5 bg-soft-fill">
        <div
          className="w-full bg-brand-fill"
          style={{ height: `${railHeightPercent}%` }}
        />
      </div>
      <Link
        href={readerHref}
        aria-label={`Open ${engagement.title}`}
        className="block"
      >
        <BookCover
          alt={`${engagement.title} cover`}
          className="mx-auto aspect-[0.72] w-full max-w-72 rounded-xs shadow-(--shadow-card) md:mx-0 md:max-w-80"
          src={resolveApiAssetUrl(engagement.coverImageUrl)}
          title={engagement.title}
        />
      </Link>
    </div>
  );
}
