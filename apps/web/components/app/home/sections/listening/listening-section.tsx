import { useTranslations } from "next-intl";
import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
import { SectionHeader, SparkIconLink } from "../../shared/home-shared";
import { ListeningControls } from "./listening-controls";

type Listening = NonNullable<HomePayload["listening"]>;

const PROGRESS_MIN_PERCENT = 8;

export function ListeningSection({
  coverImageUrl,
  listening,
}: {
  coverImageUrl: string | null;
  listening: Listening;
}) {
  const t = useTranslations("home.listening");
  const progressWidth = Math.max(listening.progressPercent, PROGRESS_MIN_PERCENT);

  return (
    <section className="space-y-8">
      <SectionHeader label={t("title")} action={<SparkIconLink href="" />} />
      <div className="rounded-lg bg-soft-fill px-6 py-6 sm:rounded-3xl sm:px-8">
        <div className="grid gap-6 md:grid-cols-[192px_1fr] md:items-center">
          <BookCover
            alt={`${listening.title} listening placeholder`}
            className="aspect-square w-32 rounded-xs shadow-(--shadow-card) sm:w-40"
            src={resolveApiAssetUrl(coverImageUrl)}
            title={listening.title}
          />
          <div className="space-y-4">
            <div>
              <h2 className="line-clamp-5 max-w-52 font-display text-[2rem] leading-[1.1] text-ink sm:max-w-none sm:text-4xl md:line-clamp-3">
                {listening.title}
              </h2>
              <p className="mt-1 text-sm italic tracking-[0.02em] text-plum sm:text-xl">
                {listening.authorLine}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-copy">
                <span>15:20</span>
                <span>42:10</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line/20 sm:h-2">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>
            <ListeningControls />
          </div>
        </div>
      </div>
    </section>
  );
}
