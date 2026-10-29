import { useState } from "react";
import { useTranslations } from "next-intl";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { useAuthorSearch } from "@/features/explore/admin/use-author-search";
export function CreditAuthorField({
  name,
  change,
}: {
  name: string;
  change: (id: string, name: string) => void;
}) {
  const t = useTranslations("explore.creditForm");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const results = useAuthorSearch(query);
  if (name && !editing)
    return (
      <div className="space-y-2">
        <span className="text-sm uppercase tracking-[0.22em] text-muted">
          {t("person")}
        </span>
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg text-copy-strong">{name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {t("change")}
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-2">
      <TextInput label={t("search")} value={query} onChange={setQuery} />
      {query.length < 2 && (
        <p className="text-sm text-muted">{t("searchHint")}</p>
      )}
      {results.error && <p role="alert">{t("searchFailed")}</p>}
      {results.loading && (
        <p role="status" className="text-sm text-muted">
          {t("searching")}
        </p>
      )}
      {query.length >= 2 &&
        !results.loading &&
        !results.error &&
        !results.authors.length && (
          <p role="status" className="text-sm text-muted">
            {t("noResults")}
          </p>
        )}
      <div className="flex flex-col items-start gap-1">
        {results.authors.map((author) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            key={author.id}
            onClick={() => {
              change(author.id, author.displayName);
              setQuery("");
              setEditing(false);
            }}
          >
            {author.displayName}
          </Button>
        ))}
      </div>
      {name && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            setQuery("");
          }}
        >
          {t("cancel")}
        </Button>
      )}
    </div>
  );
}
