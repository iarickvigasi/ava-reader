import { useTranslations } from "next-intl";
import type { EditorialRecord } from "@/features/explore/admin/types";

export function EditorialProvenance({ record }: { record: EditorialRecord }) {
  const t = useTranslations("explore.editorialForm");
  return (
    <details className="space-y-3 text-sm text-muted">
      <summary>{t("source")}</summary>
      <p>{t("record", { id: record.id, revision: record.revision })}</p>
      {record.sourceMappings.map((source, index) => (
        <dl key={index} className="space-y-1 break-all">
          {Object.entries(source).map(([key, value]) => (
            <div key={key}>
              <dt className="font-semibold">{key}</dt>
              <dd>{String(value ?? "—")}</dd>
            </div>
          ))}
        </dl>
      ))}
    </details>
  );
}
