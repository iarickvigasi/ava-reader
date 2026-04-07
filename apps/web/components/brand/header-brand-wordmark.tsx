import { cn } from "@/lib/cn";

type HeaderBrandWordmarkProps = {
  className?: string;
};

export function HeaderBrandWordmark({
  className,
}: HeaderBrandWordmarkProps) {
  return (
    <p
      className={cn(
        "font-display text-[2.4rem] leading-[0.9] tracking-[-0.08em] text-ink sm:text-[2.9rem]",
        className,
      )}
    >
      AVA
    </p>
  );
}
