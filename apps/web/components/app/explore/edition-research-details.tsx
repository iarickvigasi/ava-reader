import { useLocale, useTranslations } from "next-intl";
import type { CatalogRightsResearch } from "@/lib/catalog-import-evidence";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";
export function EditionResearchDetails({
  research,
}: {
  research: CatalogRightsResearch;
}) {
  const t = useTranslations("explore.editionSource");
  const locale = useLocale();
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <details className="space-y-5">
      <summary className="cursor-pointer font-reader text-xl text-title">
        {t("research")}
      </summary>
      <p className="text-sm text-muted">{t("researchNotice")}</p>
      <div className="grid grid-cols-2 gap-x-12 gap-y-10">
        <MetadataItem label={t("researchedWork")} value={research.title} />
        <MetadataItem label={t("researchedAuthor")} value={research.author} />
        <MetadataItem
          label={t("authorDeath")}
          value={
            <a
              href={research.authorEvidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-plum underline"
            >
              {research.authorDeathYear}
            </a>
          }
        />
        <MetadataItem
          label={t("researched")}
          value={date(research.researchedAt)}
        />
        <MetadataItem
          label={t("life70")}
          value={date(research.ordinaryLife70Expiry)}
        />
        <MetadataItem
          label={t("life100")}
          value={date(research.life100ComparisonExpiry)}
        />
      </div>
      <p className="text-sm text-muted">{t("rulesLabel")}</p>
      <ul className="space-y-2 text-sm">
        {research.rules.map((rule) => (
          <li key={rule.id}>
            <a
              href={rule.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-plum underline"
            >
              {t(`rules.${rule.id}`)}
            </a>
          </li>
        ))}
        {research.titleEvidenceUrls.map((url, index) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-plum underline"
            >
              {t("workEvidence", { number: index + 1 })}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
