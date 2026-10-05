import { useTranslations } from "next-intl";
import type { DeveloperContact } from "@/lib/api-types/home";
import { DeveloperChip } from "./developer-chip";

export function DevelopersSection({
  developers = [],
}: {
  developers?: DeveloperContact[];
}) {
  const t = useTranslations("home.developers");
  if (!developers.length) return null;
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 sm:gap-10">
      <div className="space-y-3 text-center">
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.24em]">
          {t("title")}
        </p>
        <h2 className="font-display text-[2rem] leading-[1.15] tracking-[-0.03em] text-ink sm:text-5xl">
          {t("subtitle")}
        </h2>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {developers.map((developer) => (
          <DeveloperChip key={developer.id} developer={developer} />
        ))}
      </div>
    </section>
  );
}
