import { useTranslations } from "next-intl";
import type { useConnectProfile } from "@/features/connect/use-connect-profile";

export function ConnectBookSwitch({
  model,
}: {
  model: ReturnType<typeof useConnectProfile>;
}) {
  const t = useTranslations("connect.profile");
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="text-lg text-copy-strong">{t("showBook")}</span>
        <span className="relative inline-flex shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={model.values.shareCurrentBook}
            disabled={!model.ready}
            onChange={(event) =>
              model.setShareCurrentBook(event.target.checked)
            }
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="connect-book-switch-track h-7 w-12 rounded-full bg-soft-tone-fill transition peer-checked:bg-brand-fill peer-focus-visible:ring-2 peer-focus-visible:ring-line-strong peer-disabled:opacity-55"
          />
          <span
            aria-hidden="true"
            className="connect-book-switch-thumb absolute left-1 top-1 size-5 rounded-full bg-paper shadow-(--shadow-soft) transition-transform peer-checked:translate-x-5"
          />
        </span>
      </label>
    </div>
  );
}
