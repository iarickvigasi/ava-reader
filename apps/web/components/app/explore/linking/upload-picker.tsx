"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { TextInput } from "@/components/ui/text-input";

type Upload = { libraryItemId: string; title: string; authors: string[] };
export function UploadPicker({
  uploads,
  choose,
}: {
  uploads: Upload[];
  choose: (id: string) => void;
}) {
  const t = useTranslations("explore.linkDialog");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(false);
  const search = query.trim().toLocaleLowerCase();
  const matches = uploads.filter((book) =>
    `${book.title} ${book.authors.join(" ")}`
      .toLocaleLowerCase()
      .includes(search),
  );
  return (
    <div className="space-y-3 font-ui">
      <TextInput
        label={t("searchUpload")}
        type="search"
        value={query}
        onChange={(value) => {
          setQuery(value);
          setSelected(false);
          choose("");
        }}
      />
      {!selected && (
        <ul
          className="max-h-64 overflow-y-auto"
          aria-label={t("uploadSuggestions")}
        >
          {matches.slice(0, 20).map((book) => (
            <li key={book.libraryItemId}>
              <button
                type="button"
                className="w-full rounded-control px-4 py-3 text-left hover:bg-paper focus-visible:ring-2 focus-visible:ring-line-strong"
                onClick={() => {
                  setQuery(book.title);
                  setSelected(true);
                  choose(book.libraryItemId);
                }}
              >
                {book.title} · {book.authors.join(", ")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!selected && matches.length === 0 && (
        <p role="status">{t("noUploads")}</p>
      )}
      {!selected && matches.length > 20 && (
        <p role="status">{t("refineUploads")}</p>
      )}
    </div>
  );
}
