import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function MasteryGoalStatus({
  todayVisible,
  onToday,
  remainingCopy,
  variant,
}: {
  todayVisible: boolean;
  onToday: () => void;
  remainingCopy: string;
  variant: "mobile" | "desktop";
}) {
  const t = useTranslations("home.mastery");
  return (
    <div
      className={cn(
        "flex min-h-10 items-center",
        variant === "mobile" && "justify-center",
      )}
    >
      {todayVisible ? (
        <p
          className={cn(
            "text-xl text-title",
            variant === "mobile" ? "text-center font-display" : "italic",
          )}
        >
          {remainingCopy}
        </p>
      ) : (
        <Button size="sm" variant="ghost" onClick={onToday}>
          {t("backToToday")}
        </Button>
      )}
    </div>
  );
}
