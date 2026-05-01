import Link from "next/link";
import { useTranslations } from "next-intl";
import type { HomePayload } from "@/lib/api-types";
import { Panel, SectionHeader } from "../shared/home-shared";

type Annotation = HomePayload["recentAnnotations"]["items"][number];

export function RecentAnnotationsPanel({
  annotations,
}: {
  annotations: Annotation[];
}) {
  const t = useTranslations("home.annotations");
  const annotation = annotations[0];

  return (
    <section className="space-y-6">
      <SectionHeader label={t("title")} />

      <Panel className="rounded-sm p-5 sm:rounded-3xl sm:p-8">
        {annotation ? (
          <AnnotationContent annotation={annotation} />
        ) : (
          <p className="text-base leading-7 text-copy">{t("empty")}</p>
        )}
      </Panel>
    </section>
  );
}

function AnnotationContent({ annotation }: { annotation: Annotation }) {
  const t = useTranslations("home.annotations");
  return (
    <div className="space-y-6">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink sm:text-xs">
        {t("from", { bookTitle: annotation.bookTitle })}
      </p>
      <blockquote className="text-base leading-7 text-title sm:text-[1.35rem] sm:leading-9">
        “{annotation.excerpt}”
      </blockquote>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {t("highlighter", { colorLabel: annotation.colorLabel })}
        </p>
        <Link
          href="/app/insights"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink"
        >
          {t("viewFullNotebook")}
        </Link>
      </div>
    </div>
  );
}
