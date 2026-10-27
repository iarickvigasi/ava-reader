"use client";

import { Avatar } from "@/components/app/shared/avatar";
import { UserAvatarFallback } from "@/components/auth/user-avatar-fallback";
import { useCurrentUserCached } from "@/features/offline/buckets/me";
import { useTranslations } from "next-intl";
import type { PublishedReader } from "@/lib/api-types/published-reader";
import { readerInitials } from "@/features/connect/reader-initials";

export function ConnectReaderCard({ reader }: { reader: PublishedReader }) {
  const t = useTranslations("connect.discovery");
  const currentUser = useCurrentUserCached(null);
  const name = reader.displayName || t("reader");
  return (
    <article className="connect-reader-card min-w-0 space-y-5 rounded-card bg-soft-fill p-6 sm:p-8">
      <div className="flex items-center gap-4">
        {currentUser?.id === reader.id ? (
          <UserAvatarFallback
            currentUser={currentUser}
            className="size-14 text-2xl"
          />
        ) : (
          <Avatar
            src={reader.avatarUrl}
            initials={readerInitials(name)}
            className="size-14 text-2xl"
          />
        )}
        <h3 className="min-w-0 wrap-break-word font-display text-2xl text-title">
          {name}
        </h3>
      </div>
      <p className="whitespace-pre-wrap wrap-break-word text-lg leading-7 text-copy">
        {reader.introduction}
      </p>
      {reader.currentBook && (
        <div className="space-y-1 border-t border-line/30 pt-4">
          <p className="font-ui text-[0.675rem] font-bold uppercase tracking-[0.16em] text-muted sm:text-[0.625rem]">
            {t("currentlyReading")}
          </p>
          <p className="wrap-break-word text-lg text-ink">
            {reader.currentBook.title}
            {reader.currentBook.authors.length > 0 && (
              <span className="text-sm text-copy">
                {" · "}
                {reader.currentBook.authors.join(", ")}
              </span>
            )}
          </p>
        </div>
      )}
    </article>
  );
}
