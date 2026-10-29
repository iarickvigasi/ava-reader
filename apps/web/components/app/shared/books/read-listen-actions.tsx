import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ReaderListeningIcon } from "../app-icons";
import { Button } from "@/components/ui/button";

export const READ_ACTION_CLASS_NAME =
  "relative inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-brand-fill px-6 text-sm font-semibold uppercase tracking-[0.12em] text-brand-foreground transition duration-200 hover:bg-brand-fill-strong";

export function ReadListenActions({ readAction }: { readAction: ReactNode }) {
  const t = useTranslations("library.bookInfo");
  return (
    <div className="grid w-full max-w-120 grid-cols-2 gap-3">
      {readAction}
      <Button
        type="button"
        variant="soft"
        className="min-h-12 w-full gap-2 rounded-control px-6 text-sm font-semibold uppercase tracking-[0.12em]"
      >
        <ReaderListeningIcon className="size-4" />
        {t("listen")}
      </Button>
    </div>
  );
}
