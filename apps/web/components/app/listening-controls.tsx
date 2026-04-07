"use client";

import { useState } from "react";
import { BackwardIcon, ForwardIcon, PauseIcon, PlayIcon } from "@/components/app/app-icons";

export function ListeningControls() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex items-center justify-center gap-10 pt-2 text-copy">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center text-copy transition hover:text-ink"
        aria-label="Skip backward"
      >
        <BackwardIcon className="size-5" />
      </button>
      <button
        type="button"
        className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-fill text-brand-foreground shadow-(--shadow-card)"
        aria-label={isPlaying ? "Pause audio preview" : "Play audio preview"}
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
        aria-label="Skip forward"
      >
        <ForwardIcon className="size-5" />
      </button>
    </div>
  );
}
