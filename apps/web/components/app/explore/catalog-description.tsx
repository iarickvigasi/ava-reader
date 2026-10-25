"use client";

import type { CatalogText } from "@/lib/catalog-types";
import { useCatalogDescription } from "@/features/explore/use-catalog-description";
import { BookDescription } from "@/components/app/shared/books/book-description";
import { FilterPill } from "@/components/app/shared/filter-pill";

export function CatalogDescription({ texts }: { texts: CatalogText[] }) {
  const { available, active, select } = useCatalogDescription(texts);
  return (
    <BookDescription
      hideWhenEmpty
      description={active?.description ?? null}
      headerActions={
        available.length === 1 ? (
          available[0].locale !== "und" ? (
            <span className="text-sm text-muted">{available[0].label}</span>
          ) : null
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((text) => (
              <FilterPill
                key={text.locale}
                active={text.locale === active?.locale}
                onClick={() => select(text.locale)}
              >
                {text.label}
              </FilterPill>
            ))}
          </div>
        )
      }
    />
  );
}
