"use client";

import { useTranslations } from "next-intl";
import { useCurrentUserCached } from "@/features/offline/buckets/me";
import { ConnectProfileForm } from "./connect-profile-form";

export function ConnectProfileSection() {
  const t = useTranslations("connect.profile");
  const user = useCurrentUserCached(null);
  return (
    <section aria-labelledby="connect-profile-title" className="min-w-0">
      <div className="mb-6 space-y-3 text-center">
        <h2
          id="connect-profile-title"
          className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.24em]"
        >
          {t("title")}
        </h2>
        <p className="font-display text-[2rem] leading-[1.15] tracking-[-0.03em] text-ink sm:text-5xl">
          {t("body")}
        </p>
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
