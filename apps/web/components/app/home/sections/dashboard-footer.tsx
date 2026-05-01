import Link from "next/link";
import { useTranslations } from "next-intl";

export function DashboardFooter() {
  const t = useTranslations("home.footer");
  return (
    <footer className="border-t border-line/40 pt-8 text-[0.62rem] uppercase tracking-[0.22em] text-muted sm:text-xs">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>{t("tagline")}</p>
        <div className="flex gap-6">
          <Link href="">{t("privacy")}</Link>
          <Link href="">{t("terms")}</Link>
          <Link href="">{t("contact")}</Link>
        </div>
      </div>
    </footer>
  );
}
