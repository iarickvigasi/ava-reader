import { useTranslations } from "next-intl";
import type { useConnectProfile } from "@/features/connect/use-connect-profile";
import { UserAvatarFallback } from "@/components/auth/user-avatar-fallback";

export function ConnectProfilePreview({
  model,
}: {
  model: ReturnType<typeof useConnectProfile>;
}) {
  const t = useTranslations("connect.profile");
  return (
    <div className="min-w-0 self-start space-y-3">
      <p className="font-ui text-xs leading-4 uppercase tracking-[0.16em] text-muted">
        {t("preview")}
      </p>
      <article className="space-y-5 rounded-card bg-paper p-6">
        <div className="flex items-center gap-3">
          <UserAvatarFallback currentUser={model.user} />
          <h3 className="wrap-break-word font-display text-2xl text-title">
            {model.user.displayName ?? t("reader")}
          </h3>
        </div>
        {model.values.introduction.trim() && (
          <p className="whitespace-pre-wrap wrap-break-word text-lg leading-7 text-copy">
            {model.values.introduction}
          </p>
        )}
        {model.values.shareCurrentBook && model.book && (
          <div className="space-y-1 border-t border-line/30 pt-4">
            <p className="font-ui text-xs uppercase tracking-[0.16em] text-muted">
              {t("currentlyReading")}
            </p>
            <p className="wrap-break-word text-lg text-ink">
              {model.book.title}
              {model.book.authors?.length ? (
                <span className="text-sm text-copy">
                  {" · "}
                  {model.book.authors.join(", ")}
                </span>
              ) : null}
            </p>
          </div>
        )}
      </article>
      <p className="text-sm leading-6 text-copy">{t("visibility")}</p>
    </div>
  );
}
