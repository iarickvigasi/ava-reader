import { useTranslations } from "next-intl";

export function SearchField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("reader.aiChats");
  return (
    <label className="block">
      <span className="sr-only">{t("searchAria")}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="block h-9 w-full rounded-lg bg-soft-tone-fill px-3 font-ui text-[0.78rem] uppercase tracking-[0.16em] text-muted placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ink/15"
      />
    </label>
  );
}

export function CreateChatButton({ onClick }: { onClick?: () => void }) {
  const t = useTranslations("reader.aiChats");
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-fill px-3 font-ui text-[0.78rem] uppercase tracking-[0.16em] text-brand-foreground transition hover:bg-brand-fill-strong"
    >
      <span aria-hidden="true" className="mr-1.5">
        +
      </span>
      {t("createNew")}
    </button>
  );
}
