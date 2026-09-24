import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export function HistoryPlaceholder({
  status,
  days,
  variant,
}: {
  status: "idle" | "loading" | "error";
  days: string[];
  variant: "mobile" | "desktop";
}) {
  const locale = useLocale();
  const t = useTranslations("home.mastery");
  const isMobile = variant === "mobile";
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return (
    <div
      className="relative flex h-full w-full shrink-0"
      aria-busy={status === "loading"}
    >
      <div className="sr-only" role="status">
        {status === "error" ? t("historyError") : t("loadingHistory")}
      </div>
      {days.map((key) => (
        <div
          key={key}
          className={cn(
            "grid h-full min-w-0 flex-1 grid-rows-[1fr_auto] px-1",
            isMobile ? "gap-1" : "gap-3",
          )}
        >
          <div
            className={cn(
              "h-[85%] self-end animate-pulse bg-surface-strong motion-reduce:animate-none",
              isMobile ? "rounded-t-xs" : "rounded-t-sm",
            )}
          />
          <div
            className={cn(
              "text-center",
              isMobile ? "space-y-0.5" : "space-y-1",
            )}
          >
            <p
              className={cn(
                "uppercase text-muted",
                isMobile
                  ? "text-[0.58rem] tracking-[0.12em]"
                  : "text-xs tracking-[0.14em]",
              )}
            >
              {weekday.format(new Date(`${key}T00:00:00Z`))}
            </p>
            <div
              className={cn(
                "flex items-center justify-center",
                isMobile ? "h-[1.05rem]" : "h-5",
              )}
            >
              <div className="h-2 w-6 animate-pulse rounded-full bg-surface-strong motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
