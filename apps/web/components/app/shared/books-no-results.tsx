import { useTranslations } from "next-intl";
import { LibraryNavigationIcon } from "@/components/app/core/library-navigation-icon";
import { IllustratedState } from "./illustrated-state";

export function BooksNoResults() {
  const t = useTranslations("common");
  return (
    <IllustratedState
      icon={<LibraryNavigationIcon className="size-7" />}
      message={t("noResults")}
    />
  );
}
