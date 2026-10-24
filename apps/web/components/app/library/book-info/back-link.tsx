import { BookBackLink } from "@/components/app/shared/books/book-back-link";
import { useTranslations } from "next-intl";

type BackLinkProps = {
  backHref: string;
};

export function BackLink({ backHref }: BackLinkProps) {
  const t = useTranslations("library.bookInfo");
  const label = backHref.includes("/collections/")
    ? t("backToCollection")
    : t("backToLibrary");

  return <BookBackLink href={backHref}>{label}</BookBackLink>;
}
