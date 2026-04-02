import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ProviderButtonProps = {
  icon: ReactNode;
  label: string;
  variant?: "brand" | "soft";
  onClick: () => void;
  disabled?: boolean;
};

export function ProviderButton({
  icon,
  label,
  variant = "brand",
  onClick,
  disabled,
}: ProviderButtonProps) {
  return (
    <Button
      type="button"
      variant={variant === "brand" ? "primary" : "soft"}
      className="w-full justify-center pl-[3.25rem]"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="absolute left-5 top-1/2 -translate-y-1/2">{icon}</span>
      {label}
    </Button>
  );
}
