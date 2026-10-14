import { useTranslations } from "next-intl";

export function LibraryEmptyState() {
  const t = useTranslations("library.empty");
  return (
    <p className="mx-auto max-w-xl px-5 py-12 text-center text-xl leading-8 text-copy">
      {t("body")}
    </p>
  );
}
