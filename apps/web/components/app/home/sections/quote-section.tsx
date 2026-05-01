import { useTranslations } from "next-intl";
import { QuoteMarkIcon } from "@/components/app/shared/app-icons";

export function QuoteSection() {
  const t = useTranslations("home.quote");
  return (
    <section className="flex flex-col items-center gap-5 px-2 text-center sm:gap-6">
      <QuoteMarkIcon className="h-4 w-auto text-plum sm:h-4.5" />
      <blockquote className="max-w-[18rem] font-display text-[1.8rem] leading-[1.35] text-title sm:max-w-3xl sm:text-[2.5rem]">
        &quot;{t("text")}&quot;
      </blockquote>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-plum">
        {t("attribution")}
      </p>
    </section>
  );
}
