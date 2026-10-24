import { useTranslations } from "next-intl";
import { SearchField } from "@/components/app/shared/search-field";

// Library search retains its current placeholder behavior; Explore supplies a query.
export function LibrarySearchField({ className }: { className?: string }) {
  const t = useTranslations("library.header");
  return (
    <SearchField
      className={className}
      label={t("searchAria")}
      placeholder={t("searchPlaceholder")}
      readOnly
      value=""
    />
  );
}
