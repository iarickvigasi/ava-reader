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
  return (
    <div className="flex min-h-44 flex-wrap content-start items-center justify-center gap-3 text-center sm:min-h-0 sm:justify-end sm:text-left">
      {(!model.published || model.dirty || model.status === "error") && (
        <Button
          size="sm"
          className="min-h-12! px-8! font-bold! tracking-[0.2em]! bg-soft-fill! text-ink! hover:bg-brand-fill! hover:text-brand-foreground!"
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
          size="sm"
          className="connect-hide-profile-button min-h-12! px-8! font-bold! tracking-[0.2em]! bg-soft-fill! hover:bg-soft-fill! hover:text-ink! [[data-theme=light]_&]:hover:bg-soft-tone-fill! [[data-theme=dark]_&]:hover:bg-soft-tone-fill!"
          disabled={model.busy || !model.ready}
          onClick={model.hide}
        >
          {t("hide")}
        </Button>
      )}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "order-first min-h-5 w-full min-w-0 text-sm sm:mr-auto sm:w-auto",
          model.status === "error" ? "text-danger" : "text-muted",
        )}
      >
        {t(
          model.status === "error"
            ? "error"
            : model.published
              ? "published"
              : "hideHint",
        )}
      </p>
    </div>
  );
}
