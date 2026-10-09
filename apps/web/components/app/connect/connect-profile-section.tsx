"use client";

import { useTranslations } from "next-intl";
import { useCurrentUserCached } from "@/features/offline/buckets/me";
import { ConnectProfileForm } from "./connect-profile-form";

export function ConnectProfileSection() {
  const t = useTranslations("connect.profile");
  const user = useCurrentUserCached(null);
  return (
    <section
      aria-labelledby="connect-profile-title"
      className="rounded-shell bg-paper-strong p-6 sm:p-8"
    >
      <div className="mb-6 space-y-2">
        <h2
          id="connect-profile-title"
          className="font-display text-3xl text-ink sm:text-4xl"
        >
          {t("title")}
        </h2>
        <p className="max-w-2xl text-lg leading-7 text-copy">{t("body")}</p>
      </div>
      {user ? (
        <ConnectProfileForm key={user.id} user={user} />
      ) : (
        <p role="status" className="text-copy">
          {t("unavailable")}
        </p>
      )}
    </section>
  );
}
