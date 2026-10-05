"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import { useProfileEditor } from "@/features/auth/use-profile-editor";

export function ProfileDialog({
  user,
  onClose,
}: {
  user: CurrentUserPayload;
  onClose: () => void;
}) {
  const t = useTranslations("profile");
  const id = useId();
  const editor = useProfileEditor(user);
  return (
    <ModalShell onClose={onClose} labelledBy={id} maxWidth="md">
      <form
        onSubmit={editor.save}
        className="space-y-6 rounded-modal bg-paper p-6 shadow-(--shadow-card)"
      >
        <h2 id={id} className="font-reader text-2xl text-title">
          {t("title")}
        </h2>
        <TextInput
          label={t("name")}
          value={editor.displayName}
          onChange={editor.setDisplayName}
          required
          maxLength={100}
          pattern=".*\S.*"
          autoComplete="name"
        />
        {editor.isDeveloper && (
          <div className="space-y-3">
            <TextInput
              label={t("telegram")}
              value={editor.telegramUrl}
              onChange={editor.setTelegramUrl}
              type="url"
              placeholder="https://t.me/username"
              maxLength={100}
              pattern="https://t\.me/[A-Za-z][A-Za-z0-9_]{4,31}/?"
              aria-describedby={`${id}-telegram`}
            />
            <p id={`${id}-telegram`} className="text-sm text-muted">
              {t("telegramHelp")}
            </p>
          </div>
        )}
        <p className="text-sm text-muted">{t("accountHelp")}</p>
        {editor.status && (
          <p
            role="status"
            className={
              editor.status === "error"
                ? "text-sm text-danger"
                : "text-sm text-muted"
            }
          >
            {t(editor.status)}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
          <Button type="submit" disabled={editor.busy}>
            {t("save")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
