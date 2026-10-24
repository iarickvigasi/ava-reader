import { Button } from "@/components/ui/button";

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "primary" : "soft"}
      aria-pressed={active}
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full focus-visible:ring-2 focus-visible:ring-line-strong"
    >
      {children}
    </Button>
  );
}
