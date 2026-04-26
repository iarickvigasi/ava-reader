import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReadyReaderPayload } from "../shared/types";
import { SectionLabel } from "./section-label";
import { useCloseOnEscape } from "./use-close-on-escape";

type ReaderSidebarOverlayProps = {
  activeChapter: ReaderChapterPayload;
  fontScale: number;
  isLoadingChapter: boolean;
  onClose: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  payload: ReadyReaderPayload;
};

export function ReaderSidebarOverlay({
  activeChapter,
  fontScale,
  isLoadingChapter,
  onClose,
  onDecreaseFont,
  onIncreaseFont,
  payload,
}: ReaderSidebarOverlayProps) {
  useCloseOnEscape(onClose);

  return (
    <div className="fixed inset-0 z-50">
      <SidebarBackdrop onClose={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full justify-end p-3 sm:p-5">
        <div className="flex h-full w-full max-w-md flex-col rounded-4xl border border-line/70 bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur xl:max-w-120 sm:p-6">
          <SidebarHeader
            chapterLabel={activeChapter.label}
            completionPercent={payload.progress.completionPercent}
            onClose={onClose}
          />
          <FontSizeControls
            fontScale={fontScale}
            onDecreaseFont={onDecreaseFont}
            onIncreaseFont={onIncreaseFont}
          />
          <ReaderControlsPanel />
          {isLoadingChapter ? <ChapterSwitchingIndicator /> : null}
        </div>
      </aside>
    </div>
  );
}

function SidebarBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close reader panel"
      className="absolute inset-0 bg-black/25 backdrop-blur-md"
      onClick={onClose}
    />
  );
}

function SidebarHeader({
  chapterLabel,
  completionPercent,
  onClose,
}: {
  chapterLabel: string;
  completionPercent: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.18em] text-ink/45">
          Reader
        </p>
        <p className="mt-2 font-(--font-reader) text-2xl leading-none text-ink">
          {chapterLabel}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <CompletionBadge completionPercent={completionPercent} />
        <CloseButton onClose={onClose} />
      </div>
    </div>
  );
}

function CompletionBadge({ completionPercent }: { completionPercent: number }) {
  return (
    <div className="rounded-full border border-line/50 bg-soft-fill/45 px-3 py-1.5 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.14em] text-ink/55">
      {completionPercent}%
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex size-11 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 text-ink transition hover:bg-soft-tone-fill"
      onClick={onClose}
    >
      <span className="font-(--font-ui) text-lg leading-none">×</span>
    </button>
  );
}

function FontSizeControls({
  fontScale,
  onDecreaseFont,
  onIncreaseFont,
}: {
  fontScale: number;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
}) {
  return (
    <div className="mt-6 flex items-center gap-2">
      <FontSizeButton label="A-" onClick={onDecreaseFont} />
      <FontSizeButton label="A+" onClick={onIncreaseFont} />
      <p className="ml-2 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/45">
        Type {Math.round(fontScale * 100)}%
      </p>
    </div>
  );
}

function FontSizeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex size-10 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 font-(--font-ui) text-sm text-ink transition hover:bg-soft-tone-fill"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ReaderControlsPanel() {
  return (
    <div className="mt-8 min-h-0 flex-1 space-y-3">
      <SectionLabel>Reader controls</SectionLabel>
      <div className="rounded-3xl border border-line/45 bg-white/45 p-4">
        <p className="font-(--font-reader) text-lg leading-7 text-ink">
          Open `Contents` from the left rail to jump between chapters
          while keeping this panel focused on reading controls.
        </p>
      </div>
    </div>
  );
}

function ChapterSwitchingIndicator() {
  return (
    <div className="mt-6 border-t border-line/40 pt-5">
      <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
        Switching chapters...
      </p>
    </div>
  );
}
