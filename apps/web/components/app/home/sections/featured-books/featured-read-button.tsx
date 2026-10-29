"use client";

import { useTranslations } from "next-intl";
import { useCatalogRead } from "@/features/explore/use-catalog-read";
import { LibraryNavigationIcon } from "@/components/app/core/library-navigation-icon";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { Button } from "@/components/ui/button";

export function FeaturedReadButton({ entryId }: { entryId: string }) {
  const t = useTranslations("explore");
  const { read, pending, error } = useCatalogRead(entryId);
  return (
    <div className="min-w-0 space-y-2">
      <Button
        size="sm"
        className="min-h-11 w-full min-w-0 gap-2 hover:brightness-90 [&>span]:min-w-0"
        disabled={pending}
        onClick={() => void read()}
      >
        <PendingLabel pending={pending} pendingText={t("openingBook")}>
          <LibraryNavigationIcon className="size-4 shrink-0" />
          {t("read")}
        </PendingLabel>
      </Button>
      {error && (
        <p role="alert" className="text-sm text-muted">
          {t("readingFailed")}
        </p>
      )}
    </div>
  );
}
