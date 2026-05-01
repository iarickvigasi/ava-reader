import Link from "next/link";
import { useTranslations } from "next-intl";

type BackLinkProps = {
  backHref: string;
};

export function BackLink({ backHref }: BackLinkProps) {
  const t = useTranslations("library.bookInfo");
  const label = backHref.includes("/collections/")
    ? t("backToCollection")
    : t("backToLibrary");

  return (
    <Link
      href={backHref}
      className="inline-flex text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand-fill hover:text-brand-fill-strong"
    >
      {label}
    </Link>
  );
}
