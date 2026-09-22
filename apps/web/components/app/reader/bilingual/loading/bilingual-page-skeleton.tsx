import { useTranslations } from "next-intl";

export function BilingualPageSkeleton() {
  const t = useTranslations("reader.bilingual");
  return (
    <div
      className="h-full min-w-0 flex-1 overflow-hidden"
      role="status"
      aria-label={t("loading")}
      data-bilingual-page-skeleton
    >
      <div aria-hidden="true" className="space-y-8 motion-safe:animate-pulse">
        {[0, 1, 2].map((paragraph) => (
          <div key={paragraph} className="space-y-5">
            {["w-11/12", "w-full", "w-full", "w-3/4"].map((width, line) => (
              <div
                key={line}
                className={`h-5 rounded bg-paper-strong ${width}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
