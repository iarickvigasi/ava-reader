import { cn } from "@/lib/cn";

type BrandWordmarkProps = {
  variant?: "stacked" | "compact";
  className?: string;
};

export function BrandWordmark({
  variant = "stacked",
  className,
}: BrandWordmarkProps) {
  if (variant === "compact") {
    return (
      <p
        className={cn(
          "font-display text-[4.4rem] leading-[0.9] tracking-[-0.08em] text-ink sm:text-[5.4rem]",
          className,
        )}
      >
        AVA
      </p>
    );
  }

  return (
    <div
      className={cn(
        "font-display text-ink",
        className,
      )}
    >
      <p className="text-[5.2rem] leading-[0.88] tracking-[-0.09em] sm:text-[6.6rem]">
        AVA
      </p>
      <p className="text-[5rem] leading-[0.9] tracking-[-0.08em] sm:text-[6.2rem]">
        Reader
      </p>
    </div>
  );
}
