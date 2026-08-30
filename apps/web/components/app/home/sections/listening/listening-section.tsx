import { useTranslations } from "next-intl";
import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
import { SectionHeader, SparkIconLink } from "../../shared/home-shared";
import { ListeningControls } from "./listening-controls";
import { ListeningHeading } from "./listening-heading";
import { ListeningProgress } from "./listening-progress";

type Listening = NonNullable<HomePayload["listening"]>;

// One grid, two shapes. Below `md` the cover and the heading share row 1 and
// everything under them spans the full card width; from `md` the cover spans
// all four rows in its own column so the stack sits beside it, as before.
// The mobile cover column is a percentage rather than a fixed width, so cover
// and title shrink together on a narrow phone instead of starving the title.
export function ListeningSection({
  coverImageUrl,
  listening,
}: {
  coverImageUrl: string | null;
  listening: Listening;
}) {
  const t = useTranslations("home.listening");

  return (
    <section className="space-y-8">
      <SectionHeader label={t("title")} action={<SparkIconLink href="" />} />
      <div className="rounded-lg bg-soft-fill px-6 py-6 sm:rounded-3xl sm:px-8">
        <div className="grid grid-cols-[42%_1fr] items-center gap-x-4 gap-y-6 sm:grid-cols-[10rem_1fr] sm:gap-x-6 md:grid-cols-[192px_1fr] md:gap-y-4">
          <BookCover
            alt={`${listening.title} listening placeholder`}
            className="w-full shadow-(--shadow-card) sm:w-40 md:row-span-4"
            ratio="audiobook"
            src={resolveApiAssetUrl(coverImageUrl)}
            title={listening.title}
          />
          <ListeningHeading listening={listening} />
          <p className="col-span-2 text-sm italic tracking-[0.02em] text-plum sm:text-xl md:col-span-1">
            {t("comingSoon")}
          </p>
          <ListeningProgress
            className="col-span-2 md:col-span-1"
            progressPercent={listening.progressPercent}
          />
          <ListeningControls className="col-span-2 md:col-span-1" />
        </div>
      </div>
    </section>
  );
}
