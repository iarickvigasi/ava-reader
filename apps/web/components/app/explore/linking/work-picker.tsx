"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { useCatalogResource } from "@/features/explore/use-catalog-resource";
import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
export function WorkPicker({
  choose,
}: {
  choose: (work: CatalogWork) => void;
}) {
  const t = useTranslations("explore.linkDialog");
  const [query, setQuery] = useState("");
  const result = useCatalogResource<CatalogPage<CatalogWork>>(
    query.trim().length >= 2
      ? `works?query=${encodeURIComponent(query.slice(0, 100))}`
      : null,
  );
  return (
    <div className="space-y-3">
      <TextInput label={t("searchWork")} value={query} onChange={setQuery} />
      {result.error && <p role="status">{t("catalogUnavailable")}</p>}
      {result.data?.items.map((work) => (
        <Button
          key={work.id}
          type="button"
          variant="ghost"
          onClick={() => choose(work)}
        >
          {work.originalTitle} ·{" "}
          {work.credits
            .filter((credit) => credit.role === "AUTHOR")
            .map((credit) => credit.author.displayName)
            .join(", ")}
        </Button>
      ))}
    </div>
  );
}
