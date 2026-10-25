import { useTranslations } from "next-intl";
import { LibraryNavigationIcon } from "@/components/app/core/library-navigation-icon";

export function BooksNoResults() {
  const t = useTranslations("common");
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-card bg-paper px-6 py-10 text-center sm:px-10 sm:py-14"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-soft-fill text-ink"
      >
        <LibraryNavigationIcon className="size-7" />
      </span>
      <p className="mt-6 max-w-xl font-display text-2xl text-title sm:text-3xl">
        {t("noResults")}
      </p>
    </div>
  );
}
