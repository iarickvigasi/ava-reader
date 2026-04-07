import { cn } from "@/lib/cn";

type AppHeaderBrandProps = {
  className?: string;
};

export function AppHeaderBrand({ className }: AppHeaderBrandProps) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <p className="font-display text-[1.5rem] leading-[0.9] tracking-[-0.08em] text-ink sm:text-[1.75rem]">
        AVA
      </p>
    </div>
  );
}
