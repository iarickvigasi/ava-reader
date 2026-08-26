import { useTranslations } from "next-intl";
import { clamp } from "../../shared/utils";

type ContentsProgressProps = {
  chapterCount: number;
  completionPercent: number;
};

export function ContentsProgress({
  chapterCount,
  completionPercent,
}: ContentsProgressProps) {
  const t = useTranslations("reader.contents");
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <span className="font-ui text-[0.62rem] uppercase tracking-[0.16em] text-ink/55">
          {t("completed", { percent: completionPercent })}
        </span>
        <span className="font-ui text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
          {t("chapterCount", { count: chapterCount })}
        </span>
      </div>
      <ProgressBar completionPercent={completionPercent} />
    </div>
  );
}

function ProgressBar({ completionPercent }: { completionPercent: number }) {
  return (
    <div className="mt-3 h-1.5 rounded-full bg-line/20">
      <div
        className="h-full rounded-full bg-title transition-[width]"
        style={{
          width: `${clamp(completionPercent, 0, 100)}%`,
        }}
      />
    </div>
  );
}
