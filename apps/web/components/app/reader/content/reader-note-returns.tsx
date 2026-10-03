import type { ReaderLinkTarget } from "@/lib/api-types/reader-content";
import { useReaderNavigationActions } from "../state/reader-navigation-context";
import { Button } from "@/components/ui/button";

export function ReaderNoteReturns({
  returns,
  blockId,
}: {
  blockId: string;
  returns: { label: string; target: ReaderLinkTarget }[];
}) {
  const navigation = useReaderNavigationActions();
  const canReturn =
    navigation?.canBack && navigation.referenceBlockId === blockId;
  return (
    <nav aria-label="Note references" className="flex flex-wrap gap-2 text-sm">
      <Button
        size="sm"
        variant="ghost"
        disabled={!canReturn}
        aria-hidden={!canReturn}
        className={canReturn ? undefined : "invisible"}
        onClick={navigation?.back}
      >
        Return to reference
      </Button>
      {returns.map((item, index) => (
        <Button
          key={item.label}
          size="sm"
          variant="ghost"
          onClick={() => navigation?.jump(item.target, undefined, true)}
        >
          Reference {index + 1}
        </Button>
      ))}
    </nav>
  );
}
