import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The header's primary action. Inert until collection create has an endpoint
// (spec 3.3). Shared by both header layouts so the phone and desktop
// copies cannot drift apart visually; callers pass width only.
export function NewCollectionButton({ className }: { className?: string }) {
  const t = useTranslations("library.header");
  return (
    <Button
      type="button"
      variant="primary"
      className={cn(
        "min-h-10 rounded-control px-4 text-[0.72rem] uppercase tracking-[0.14em] shadow-(--shadow-nav)",
        className,
      )}
    >
      {t("newCollection")}
    </Button>
  );
}
