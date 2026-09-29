import { Button } from "@/components/ui/button";
import { useReaderNavigationActions } from "../state/reader-navigation-context";

export function ReaderJumpControls() {
  const navigation = useReaderNavigationActions();
  if (!navigation) return null;
  // Keep the viewport stable while pending text becomes Back or the last return clears.
  return (
    <div className="flex min-h-12 shrink-0 items-center gap-3 py-1 text-sm">
      {navigation.canBack && (
        <Button
          size="sm"
          variant="soft"
          disabled={navigation.pending}
          onClick={navigation.back}
        >
          Back to previous place
        </Button>
      )}
      <span role="status" aria-live="polite">
        {navigation.error ?? (navigation.pending ? "Opening passage…" : "")}
      </span>
    </div>
  );
}
