import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { canonicalSourcePages } from "@/features/reader/canonical/source-pages";
import type { ReaderPackageV3 } from "@/lib/api-types/canonical-reader.generated";

export function ContentsSourcePages({
  readerPackage,
  onSelectChapter,
}: {
  readerPackage?: ReaderPackageV3;
  onSelectChapter: (chapterId: string, target: ReaderNavigationTarget) => void;
}) {
  const t = useTranslations("reader.contents");
  const pages = useMemo(
    () => (readerPackage ? canonicalSourcePages(readerPackage.book) : []),
    [readerPackage],
  );
  if (!pages.length) return null;
  return (
    <details className="mt-8 font-ui text-sm text-title">
      <summary className="cursor-pointer rounded-control py-2 focus-visible:outline-2 focus-visible:outline-brand">
        {t("sourcePages")}
      </summary>
      <p className="my-2 text-xs leading-5 text-muted">
        {t("sourcePageDescription")}
      </p>
      <nav aria-label={t("sourcePages")}>
        <ol className="grid grid-cols-2 gap-2">
          {pages.map((page) => (
            <li key={page.number}>
              <button
                type="button"
                disabled={!page.target}
                className="w-full rounded-control px-2 py-2 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
                aria-label={t("sourcePageLabel", {
                  label: page.label,
                  number: page.number,
                })}
                onClick={() =>
                  page.target &&
                  onSelectChapter(page.target.chapterId, {
                    blockId: page.target.blockId,
                    textOffset: page.target.textOffset,
                  })
                }
              >
                {page.label}
                {page.label !== String(page.number) && (
                  <span className="ml-2 text-xs text-muted">
                    ({page.number})
                  </span>
                )}
                {!page.target && (
                  <span className="ml-2 text-xs text-muted">
                    {t("sourcePageEmpty")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
