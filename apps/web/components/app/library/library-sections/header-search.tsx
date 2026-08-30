import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

// Library search: readOnly placeholder — there is no query behind it yet. Both
// header layouts render it, so the field markup and its label live in one place.
export function LibrarySearchField({ className }: { className?: string }) {
  const t = useTranslations("library.header");
  return (
    <label className={cn("block", className)}>
      <span className="sr-only">{t("searchAria")}</span>
      <input
        aria-label={t("searchAria")}
        className="h-10 w-full rounded-control bg-paper-strong/90 px-4 text-[0.82rem] uppercase tracking-[0.14em] text-title outline-none placeholder:text-muted"
        placeholder={t("searchPlaceholder")}
        readOnly
        value=""
      />
    </label>
  );
}
