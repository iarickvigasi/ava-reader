import {
  ReaderListeningIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import { Button, ButtonLink } from "@/components/ui/button";

type BookActionsProps = {
  libraryItemId: string;
};

export function BookActions({ libraryItemId }: BookActionsProps) {
  return (
    <div className="grid w-full max-w-120 grid-cols-2 gap-3">
      <ButtonLink
        href={`/app/read/${libraryItemId}`}
        className="min-h-12 w-full gap-2 rounded-[10px] px-6 text-sm font-semibold uppercase tracking-[0.12em]"
      >
        <StackBooksIcon className="size-4" />
        Read
      </ButtonLink>
      <Button
        type="button"
        variant="soft"
        className="min-h-12 w-full gap-2 rounded-[10px] px-6 text-sm font-semibold uppercase tracking-[0.12em]"
      >
        <ReaderListeningIcon className="size-4" />
        Listen
      </Button>
    </div>
  );
}
