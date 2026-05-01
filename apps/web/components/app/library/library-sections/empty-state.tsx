import { useTranslations } from "next-intl";

export function LibraryEmptyState() {
  const t = useTranslations("library.empty");
  return (
    <section className="rounded-[28px] bg-paper-strong/75 px-6 py-10 sm:px-8">
      <div className="max-w-2xl space-y-4">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-brand-fill">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl leading-[1.02] text-title sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg leading-8 text-copy">{t("body")}</p>
      </div>
    </section>
  );
}
