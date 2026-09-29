"use client";

import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { useAuthNotice } from "@/features/auth/use-auth-notice";

export function AuthStatusNotice() {
  const { state, visible, dismiss } = useAuthNotice();
  const t = useTranslations("auth.device");
  if (!visible) return null;
  return (
    <aside
      role="status"
      className="fixed right-4 bottom-24 z-40 max-w-xs rounded-card bg-paper p-4 text-sm text-copy shadow-(--shadow-card) md:bottom-4"
    >
      <div className="flex items-start gap-2">
        <p>{t(state === "sign-in-required" ? "syncPaused" : "reconnecting")}</p>
        {state === "unavailable" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={dismiss}
            aria-label={t("closeNotice")}
            className="shrink-0"
          >
            <span aria-hidden="true">×</span>
          </Button>
        )}
      </div>
      {state === "sign-in-required" && (
        <ButtonLink href="/sign-in" variant="soft" size="sm" className="mt-2">
          {t("signIn")}
        </ButtonLink>
      )}
    </aside>
  );
}
