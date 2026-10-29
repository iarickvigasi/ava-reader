import { useTranslations } from "next-intl";
import { useState } from "react";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { useCatalogResource } from "@/features/explore/use-catalog-resource";
import type { EditionChoice } from "@/features/explore/linking/use-edition-work-dialog";
export function EditionSearch({
  choose,
}: {
  choose: (edition: EditionChoice) => void;
}) {
  const t = useTranslations("explore.linkDialog");
  const [query, setQuery] = useState("");
  const result = useCatalogResource<EditionChoice[]>(
    query.length >= 2
      ? `editions?query=${encodeURIComponent(query.slice(0, 100))}`
      : null,
  );
  return (
    <div className="space-y-3">
      <TextInput label={t("searchEdition")} value={query} onChange={setQuery} />
      {result.error && <p role="alert">{t("searchFailed")}</p>}
      {result.data?.map((edition) => (
        <Button
          key={edition.id}
          variant="ghost"
          onClick={() => choose(edition)}
        >
          {edition.title} · {edition.language}
        </Button>
      ))}
    </div>
  );
}
