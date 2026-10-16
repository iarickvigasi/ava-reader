import { useTranslations } from "next-intl";
import { LibraryNavigationIcon } from "@/components/app/core/library-navigation-icon";
import { PageHeader } from "@/components/app/shared/page-header";

export function LibraryHeader() {
  const t = useTranslations("library.introduction");
  return (
    <section aria-labelledby="library-title">
      <PageHeader
        icon={LibraryNavigationIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("body")}
        titleId="library-title"
      />
    </section>
  );
}
