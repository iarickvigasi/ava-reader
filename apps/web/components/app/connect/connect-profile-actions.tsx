import { useTranslations } from "next-intl";
import type { useConnectProfile } from "@/features/connect/use-connect-profile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function ConnectProfileActions({
  model,
}: {
  model: ReturnType<typeof useConnectProfile>;
}) {
  const t = useTranslations("connect.profile");
  const showSave = model.published && (model.dirty || model.status === "error");
  return (
    <div className="flex flex-wrap items-center gap-3">
      {(!model.published || model.dirty || model.status === "error") && (
        <Button
          type="submit"
          disabled={!model.valid || model.busy || !model.ready}
        >
          {t(model.published ? "save" : "publish")}
        </Button>
      )}
      {model.published && (
        <Button
          type="button"
          variant="soft"
          className="connect-hide-profile-button"
          disabled={model.busy || !model.ready}
          onClick={model.hide}
        >
          {t("hide")}
        </Button>
      )}
      {!model.published && model.status === "hidden" && (
        <p className="text-sm text-muted">{t("hideHint")}</p>
      )}
      {(model.status === "published" || model.status === "error") && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "text-sm",
            model.status === "error" ? "text-danger" : "text-muted",
            showSave ? "w-full" : "min-w-0 flex-1",
          )}
        >
          {t(model.status)}
        </p>
      )}
    </div>
  );
}
