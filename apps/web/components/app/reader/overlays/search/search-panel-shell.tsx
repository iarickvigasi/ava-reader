import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PanelTitle } from "../panel-title";
import { MobileCloseButton } from "../mobile-close-button";

export function SearchPanelShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("reader.search");
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
      />
      <aside
        aria-label={t("title")}
        className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94"
      >
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <div className="absolute inset-0 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-(--shadow-soft) backdrop-blur-[7px] md:hidden" />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <div className="flex items-start justify-between gap-4">
                <PanelTitle>{t("title")}</PanelTitle>
                <MobileCloseButton ariaLabel={t("close")} onClose={onClose} />
              </div>
              {children}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
