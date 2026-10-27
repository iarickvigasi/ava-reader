"use client";

import { useCurrentUserCached } from "@/features/offline/buckets/me";
import { UserAvatarFallback } from "@/components/auth/user-avatar-fallback";
import { Avatar } from "@/components/app/shared/avatar";
import { useDeveloperAvatar } from "@/features/offline/buckets/home";
import { useTranslations } from "next-intl";
import type { DeveloperContact } from "@/lib/api-types/home";

export function DeveloperChip({ developer }: { developer: DeveloperContact }) {
  const t = useTranslations("home.developers");
  const currentUser = useCurrentUserCached(null);
  const src = useDeveloperAvatar(developer.id, developer.avatarUrl);
  return (
    <a
      href={developer.telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("message", { name: developer.displayName })}
      className="inline-flex min-h-13 max-w-full items-center gap-3 rounded-control bg-soft-fill px-4 py-3 text-soft-foreground transition duration-200 hover:bg-soft-tone-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
    >
      {currentUser?.id === developer.id ? (
        <UserAvatarFallback currentUser={currentUser} className="size-10" />
      ) : (
        <Avatar
          src={src}
          initials={developer.displayName.charAt(0).toUpperCase()}
          className="size-10"
        />
      )}
      <span className="min-w-0 break-words text-lg font-medium">
        {developer.displayName}
      </span>
    </a>
  );
}
