import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ScreenContainerProps = {
  children: ReactNode;
  className?: string;
};

export function ScreenContainer({
  children,
  className,
}: ScreenContainerProps) {
  return (
    <main className=" flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 sm:px-8 lg:px-10">
        <div className={cn("flex flex-1 flex-col", className)}>{children}</div>
      </div>
    </main>
  );
}
