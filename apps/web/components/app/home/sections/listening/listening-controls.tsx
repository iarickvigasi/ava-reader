"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BackwardIcon, ForwardIcon, PauseIcon, PlayIcon } from "@/components/app/shared/app-icons";

export function ListeningControls() {
  const t = useTranslations("home.listening");
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex items-center justify-center gap-10 pt-2 text-copy">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center text-copy transition hover:text-ink"
        aria-label={t("skipBackward")}
      >
        <BackwardIcon className="size-5" />
      </button>
      <button
        type="button"
        className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-fill text-brand-foreground shadow-(--shadow-card)"
        aria-label={isPlaying ? t("pause") : t("play")}
        aria-pressed={isPlaying}
        onClick={() => setIsPlaying((current) => !current)}
      >
        {isPlaying ? (
          <PauseIcon className="h-3.5 w-auto" />
        ) : (
          <PlayIcon className="h-[15.24px] w-auto" />
        )}
      </button>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center text-copy transition hover:text-ink"
        aria-label={t("skipForward")}
      >
        <ForwardIcon className="size-5" />
      </button>
    </div>
  );
}
