"use client";

import { useState, useTransition } from "react";
import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";

type CatalogAddButtonProps = {
  className?: string;
  entryId: string;
};

export function CatalogAddButton({
  className,
  entryId,
}: CatalogAddButtonProps) {
  const t = useTranslations("home.catalogAdd");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "added" | "existing" | "error">(
    "idle",
  );
  const [isPending, startTransition] = useTransition();

  async function addToLibrary() {
    if (!isLoaded || !isSignedIn) {
      setState("error");
      return;
    }

    const token = await getToken();

    if (!token) {
      setState("error");
      return;
    }

    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/catalog/${entryId}/add-to-library`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      setState("error");
      return;
    }

    const payload = (await response.json()) as { state: "added" | "existing" };
    setState(payload.state);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/40 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          void addToLibrary();
        })
      }
    >
      <span className="min-w-0">
        {isPending
          ? t("adding")
          : state === "added"
            ? t("added")
            : state === "existing"
              ? t("inLibrary")
              : state === "error"
                ? t("retry")
                : t("add")}
      </span>
    </button>
  );
}
