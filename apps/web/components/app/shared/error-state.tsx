import { Button } from "@/components/ui/button";
import { IllustratedState } from "./illustrated-state";
import { WarningIcon } from "./warning-icon";

export function ErrorState({
  message,
  retryLabel,
  retry,
}: {
  message: string;
  retryLabel: string;
  retry: () => void;
}) {
  return (
    <IllustratedState
      role="alert"
      icon={<WarningIcon className="size-7" />}
      message={message}
      action={
        <Button type="button" size="sm" variant="soft" onClick={retry}>
          {retryLabel}
        </Button>
      }
    />
  );
}
