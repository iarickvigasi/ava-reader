import { useTranslations } from "next-intl";

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
