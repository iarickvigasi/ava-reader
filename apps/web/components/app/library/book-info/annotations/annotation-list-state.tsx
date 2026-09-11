import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AnnotationLoadStatus } from "@/features/annotations/annotation-sources";

type AnnotationListStateProps = {
  status: AnnotationLoadStatus;
  emptyLabel: string;
  onRetry: () => void;
};

export function AnnotationListState({ status, emptyLabel, onRetry }: AnnotationListStateProps) {
  const t = useTranslations("library.bookInfo.annotations");
  return (
    <div role="status" className="space-y-3 pb-2">
      <p className="font-reader text-copy">
        {status === "loading" ? t("loading") : status === "error" ? t("loadFailed") : emptyLabel}
      </p>
      {status === "error" ? (
        <Button variant="soft" size="sm" onClick={onRetry}>{t("retry")}</Button>
      ) : null}
    </div>
  );
}
